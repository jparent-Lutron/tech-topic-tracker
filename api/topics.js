const { getClient } = require('./_client');
const { cors, preflight } = require('./_cors');

module.exports = async (req, res) => {
  if (preflight(req, res)) return;
  cors(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getClient();

  const search = (req.query.search || '').toString().trim().toLowerCase();
  const visitor = (req.query.visitor || '').toString().trim();

  // Fetch settings
  const { data: settingsRows, error: settingsErr } = await supabase
    .from('settings')
    .select('*')
    .limit(1);
  if (settingsErr) return res.status(500).json({ error: settingsErr.message });
  const settings = settingsRows && settingsRows[0] ? settingsRows[0] : { accepting: true };

  // Fetch topics
  let topicsQuery = supabase
    .from('topics')
    .select('id, title, score, created_at')
    .order('score', { ascending: false })
    .order('title', { ascending: true });

  if (search) {
    // simple ILIKE filter for search terms
    topicsQuery = topicsQuery.ilike('title', `%${search}%`);
  }

  const { data: topics, error: topicsErr } = await topicsQuery;
  if (topicsErr) return res.status(500).json({ error: topicsErr.message });

  // Fetch completed
  const { data: completed, error: completedErr } = await supabase
    .from('completed')
    .select('id, title, score, contributors, completed_at, video_url')
    .order('completed_at', { ascending: false })
    .order('title', { ascending: true });
  if (completedErr) return res.status(500).json({ error: completedErr.message });

  // Fetch visitor votes (to disable buttons client-side)
  let userVotes = [];
  if (visitor) {
    const { data: votes, error: votesErr } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('visitor_id', visitor);
    if (!votesErr && votes) userVotes = votes.map(v => v.topic_id);
  }

  res.json({ settings, topics, completed, userVotes });
};