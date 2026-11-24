const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkMessages() {
  console.log("Checking for new messages...");
  try {
    // যেসব মেসেজ এখনো নোটিফিকেশন পাঠানো হয়নি (notificationSent = false) সেগুলো খোঁজা
    const messagesSnapshot = await db.collectionGroup('messages')
      .where('notificationSent', '==', false)
      .get();

    if (messagesSnapshot.empty) {
      console.log("No new messages found.");
      return;
    }

    // একবারে অনেক মেসেজ থাকলে সেগুলো প্রসেস করা
    const promises = messagesSnapshot.docs.map(async (doc) => {
      const msg = doc.data();
      const receiverId = msg.receiverId;
      const text = msg.text;

      // প্রাপকের ফোনের টোকেন বের করা
      const userDoc = await db.collection('users').doc(receiverId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;

        if (fcmToken) {
          // নোটিফিকেশন পাঠানো
          const payload = {
            notification: {
              title: "নতুন মেসেজ 💬",
              body: text,
            }
          };
          try {
            await admin.messaging().sendToDevice(fcmToken, payload);
            console.log(`Notification sent to ${receiverId}`);
          } catch (err) {
            console.error("FCM Error:", err);
          }
        }
      }

      // নোটিফিকেশন পাঠানো শেষ, তাই মেসেজটাকে true মার্ক করে দেওয়া যাতে আবার না পাঠায়
      return doc.ref.update({ notificationSent: true });
    });

    await Promise.all(promises);
    console.log("All new messages processed.");
  } catch (error) {
    console.error("Error checking messages:", error);
  }
}

checkMessages();
