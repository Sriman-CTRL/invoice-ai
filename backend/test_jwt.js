const jwt = require('jsonwebtoken');
try {
    jwt.verify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsIm9yZ2FuaXphdGlvbl9pZCI6ImY1NTAxOGJmLWM4ZjktNGQxMS04NTA5LTI3NWU1OWNlODUxNyIsImlhdCI6MTc5MDc4OTczOSwiZXhwIjoxNzkwODc2MTM5fQ.lmWsGSO0fOT6YDE04PYAio4ZVJDLXuhfBO2My2DB9eI', 'fallback_secret_for_development');
    console.log('Valid inside node!');
} catch (e) {
    console.log('Invalid inside node:', e.message);
}
