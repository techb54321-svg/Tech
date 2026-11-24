import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export const MAX_PHOTO_SIDE = 1500;

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Shrinks a photo so its longest side is at most 1500 px. */
export async function resizeForUpload(asset: ImagePicker.ImagePickerAsset): Promise<PickedPhoto> {
  const { width, height } = asset;
  const longest = Math.max(width, height);
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_PHOTO_SIDE) {
    if (width >= height) ctx.resize({ width: MAX_PHOTO_SIDE });
    else ctx.resize({ height: MAX_PHOTO_SIDE });
  }
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * Opens the camera. Asks for camera permission first; if refused, explains
 * how to turn it on in Settings.
 */
export async function takePhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      'Camera access is off',
      'To take a photo of a plant, allow camera access for Patch in your phone settings. You can also choose a photo instead.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ],
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (result.canceled || !result.assets?.[0]) return null;
  return resizeForUpload(result.assets[0]);
}

/**
 * Opens the phone's built-in photo picker. This only shares the one photo
 * the person picks, so Patch never needs access to the whole photo library.
 */
export async function choosePhoto(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return resizeForUpload(result.assets[0]);
}
