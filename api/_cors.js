function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
}

function preflight(req, res){
  if (req.method === 'OPTIONS') {
    cors(res);
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = { cors, preflight };