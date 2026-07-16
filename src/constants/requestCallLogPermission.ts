import { PermissionsAndroid } from 'react-native';

async function requestCallLogPermission() {
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    {
      title: 'Call Log Permission',
      message: 'This app needs access to your call logs.',
      buttonPositive: 'Allow',
    }
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}