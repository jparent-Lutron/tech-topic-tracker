const { getClient } = require('./_client');
const { cors, preflight } = require('./_cors');

module.exports = async (req, res) => {
  if (preflight(req, res)) return;
  cors(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getClient();

  try {
    const { title, name, company, visitorId } = req.body || {};
    if (!title || !visitorId) return res.status(400).json({ error: 'Missing title or visitorId' });

    // Check accepting
    const { data: srows } = await supabase.from('settings').select('*').limit(1);
    const accepting = srows && srows[0] ? !!srows[0].accepting : true;
    if (!accepting) return res.status(403).json({ error: 'New topics are disabled' });

    // Create new topic with initial score 1
    const { data: topicRows, error: tErr } = await supabase
      .from('topics')
      .insert({ title, score: 1 })
      .select('id, title, score, created_at')
      .single();
    if (tErr) return res.status(500).json({ error: tErr.message });

    const topicId = topicRows.id;

    // Insert contributor
    await supabase.from('contributors').insert({ topic_id: topicId, name: name || 'Anonymous', company: company || '', via: 'new' });

    // Add vote record
    await supabase.from('votes').insert({ topic_id: topicId, visitor_id: visitorId });

    return res.json({ topic: topicRows, counted: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};