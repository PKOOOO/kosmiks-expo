import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_WIDTH = 1600;
// Salon photos are shown as landscape tiles, so they're cropped to 4:3.
const CROP_WIDTH = 1600;
const CROP_HEIGHT = 1200;

export type PickedPhoto = {
  uri: string;
  width: number;
  /** Already a cropped, resized JPEG — prepareForUpload can pass it straight through. */
  ready: boolean;
};

const brand = {
  dark: '#423120',
  light: '#F4EDE5',
};

const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

// iOS's built-in picker crop is always square, so on iOS the photo is picked
// without editing and then cropped to 4:3 with react-native-image-crop-picker.
// Android's picker crop already honours the 4:3 aspect.
async function cropLandscapeIOS(asset: ImagePicker.ImagePickerAsset): Promise<PickedPhoto | null> {
  let cropper: typeof import('react-native-image-crop-picker').default;
  try {
    cropper = require('react-native-image-crop-picker').default;
  } catch {
    return { uri: asset.uri, width: asset.width ?? 0, ready: false };
  }
  try {
    const cropped = await cropper.openCropper({
      path: asset.uri,
      mediaType: 'photo',
      width: CROP_WIDTH,
      height: CROP_HEIGHT,
      forceJpg: true,
      compressImageQuality: 0.78,
      cropperToolbarTitle: 'Crop photo',
      cropperChooseText: 'Use photo',
      cropperCancelText: 'Cancel',
      cropperToolbarColor: brand.light,
      cropperToolbarWidgetColor: brand.dark,
      cropperActiveWidgetColor: brand.dark,
    });
    return { uri: toFileUri(cropped.path), width: cropped.width, ready: true };
  } catch (e: any) {
    if (e?.code === 'E_PICKER_CANCELLED') return null;
    // Native module missing (e.g. Expo Go) — fall back to the uncropped photo.
    return { uri: asset.uri, width: asset.width ?? 0, ready: false };
  }
}

/**
 * Opens the photo library and a 4:3 landscape crop step. Returns null if the
 * user cancels either step.
 *
 * `Current` skips iOS's HEIC→JPEG transcode before the picker returns — the
 * photo is converted afterwards instead, which is much faster.
 */
export async function pickSalonPhoto(): Promise<PickedPhoto | null> {
  const isIOS = Platform.OS === 'ios';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !isIOS,
    aspect: [4, 3],
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (isIOS) return cropLandscapeIOS(asset);
  return { uri: asset.uri, width: asset.width ?? 0, ready: false };
}

/** Resizes to at most 1600px wide and re-encodes as JPEG; returns the file URI to upload. */
export async function prepareForUpload(photo: PickedPhoto): Promise<string> {
  if (photo.ready) return photo.uri;
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (photo.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.78, format: SaveFormat.JPEG });
  return saved.uri;
}
