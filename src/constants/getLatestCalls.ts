// import CallLogs from 'react-native-call-log';
// import requestCa

// async function getLatestCall() {
//   const hasPermission = await requestCallLogPermission();

//   if (!hasPermission) return;

//   const logs = await CallLogs.load(1); // Get the most recent call

//   if (logs.length > 0) {
//     const latest = logs[0];

//     console.log({
//       phoneNumber: latest.phoneNumber,
//       duration: latest.duration, // seconds
//       type: latest.type, // INCOMING, OUTGOING, MISSED
//       date: latest.dateTime,
//     });
//   }
// }