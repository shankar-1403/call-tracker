import { PermissionsAndroid, Platform } from 'react-native';

const ANDROID_CALL_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
  PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
  PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS,
] as const;

export async function hasCallLogPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const results = await Promise.all(
    ANDROID_CALL_PERMISSIONS.map((permission) =>
      PermissionsAndroid.check(permission),
    ),
  );

  return results.every((granted) => granted);
}

export async function requestCallLogPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const alreadyGranted = await hasCallLogPermissions();
  if (alreadyGranted) {
    return true;
  }

  const results = await PermissionsAndroid.requestMultiple([
    ...ANDROID_CALL_PERMISSIONS,
  ]);

  return Object.values(results).every(
    (status) => status === PermissionsAndroid.RESULTS.GRANTED,
  );
}
