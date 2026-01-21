const { getClient } = require('./_client');
const { cors, preflight } = require('./_cors');

module.exports = async (req, res) => {
  if (preflight(req, res)) return;
  cors(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getClient();

  try {
    const { topicId, name, company, visitorId } = req.body || {};
    if (!topicId || !visitorId) return res.status(400).json({ error: 'Missing topicId or visitorId' });

    // Try to insert vote; if already exists, do not double-count
    const { error: vErr } = await supabase
      .from('votes')
      .insert({ topic_id: topicId, visitor_id: visitorId });

    if (vErr) {
      // Unique violation means they already voted
      return res.json({ counted: false, reason: 'already_voted' });
    }

    // Increment score atomically
    const { data: updated, error: uErr } = await supabase
      .from('topics')
      .update({ score: supabase.rpc('noop') }) // placeholder; will do raw increment below
      .eq('id', topicId)
      .select('id, score')
      .single();

    // Workaround: Supabase doesn't allow expressions in update with js client directly.
    // Use RPC to increment score.
    await supabase.rpc('increment_topic_score', { p_topic_id: topicId, p_amount: 1 });

    // Add contributor row (optional fields)
    await supabase.from('contributors').insert({ topic_id: topicId, name: name || 'Anonymous', company: company || '' });

    return res.json({ counted: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};