const admin = require('firebase-admin');

// Inicjalizacja Firebase Admin SDK (tylko raz!)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();

exports.handler = async function(event, context) {
  // Pobierz akcję i ID z adresu URL, np. /api/likes/4
  const path = event.path.replace('/api/', '').split('/');
  const action = path[0];
  const id = path[1];
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    if (action === 'likes' && id) {
      const likesRef = db.ref(`articles/${id}/likes`);
      await likesRef.set(admin.database.ServerValue.increment(body.increment));
      return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } else if (action === 'comments' && id) {
      const commentsRef = db.ref(`comments/${id}`);
      await commentsRef.push({
        author: body.author,
        message: body.message,
        timestamp: admin.database.ServerValue.TIMESTAMP,
      });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    
    } else {
      return { statusCode: 404, body: 'Not Found' };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
