const { getClient } = require('./_client');
const { cors, preflight } = require('./_cors');

module.exports = async (req, res) => {
  if (preflight(req, res)) return;
  cors(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getClient();

  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_PASSPHRASE) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action } = req.body || {};
  try {
    switch(action){
      case 'toggleAccepting': {
        const { data: srows } = await supabase.from('settings').select('*').limit(1);
        if (!srows || !srows[0]){
          await supabase.from('settings').insert({ accepting: false });
          return res.json({ accepting: false });
        }
        const accepting = !srows[0].accepting;
        await supabase.from('settings').update({ accepting }).eq('id', srows[0].id);
        return res.json({ accepting });
      }
      case 'incrementVote': {
        const { topicId, amount } = req.body || {};
        if (!topicId) return res.status(400).json({ error: 'Missing topicId' });
        const inc = Number.isFinite(amount) ? amount : 1;
        await supabase.rpc('increment_topic_score', { p_topic_id: topicId, p_amount: inc });
        return res.json({ ok: true });
      }
      case 'merge': {
        const { fromId, intoId } = req.body || {};
        if(!fromId || !intoId || fromId === intoId) return res.status(400).json({ error: 'Invalid merge ids' });
        const { data: from } = await supabase.from('topics').select('id, score').eq('id', fromId).single();
        const { data: into } = await supabase.from('topics').select('id, score').eq('id', intoId).single();
        if(!from || !into) return res.status(404).json({ error: 'Topic not found' });
        // move contributors
        await supabase.from('contributors').update({ topic_id: intoId }).eq('topic_id', fromId);
        // increment into score
        await supabase.rpc('increment_topic_score', { p_topic_id: intoId, p_amount: from.score });
        // delete from
        await supabase.from('topics').delete().eq('id', fromId);
        // move votes (optional): not necessary for count, but we can move to preserve uniqueness
        await supabase.from('votes').update({ topic_id: intoId }).eq('topic_id', fromId);
        return res.json({ ok: true });
      }
      case 'edit': {
        const { id, title } = req.body || {};
        if(!id || !title) return res.status(400).json({ error: 'Missing id/title' });
        await supabase.from('topics').update({ title }).eq('id', id);
        return res.json({ ok: true });
      }
      case 'delete': {
        const { id } = req.body || {};
        if(!id) return res.status(400).json({ error: 'Missing id' });
        await supabase.from('contributors').delete().eq('topic_id', id);
        await supabase.from('votes').delete().eq('topic_id', id);
        await supabase.from('topics').delete().eq('id', id);
        return res.json({ ok: true });
      }
      case 'complete': {
        const { id, completedAt, videoUrl } = req.body || {};
        if(!id) return res.status(400).json({ error: 'Missing id' });
        const { data: topic } = await supabase.from('topics').select('*').eq('id', id).single();
        if(!topic) return res.status(404).json({ error: 'Topic not found' });
        const { data: contr } = await supabase.from('contributors').select('name, company, via, created_at').eq('topic_id', id);
        await supabase.from('completed').insert({
          id: topic.id,
          title: topic.title,
          score: topic.score,
          contributors: contr || [],
          completed_at: completedAt || new Date().toISOString().slice(0,10),
          video_url: videoUrl || ''
        });
        await supabase.from('contributors').delete().eq('topic_id', id);
        await supabase.from('votes').delete().eq('topic_id', id);
        await supabase.from('topics').delete().eq('id', id);
        return res.json({ ok: true });
      }
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch(e){
    return res.status(500).json({ error: e.message });
  }
};