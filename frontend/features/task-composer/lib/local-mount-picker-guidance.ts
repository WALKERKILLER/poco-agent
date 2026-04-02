export function getLocalMountPickerGuidance(
  nativePickerSupported: boolean,
): string[] {
  if (!nativePickerSupported) {
    return [
      "filesystem.picker.notSupported",
      "filesystem.picker.searchLimitation",
    ];
  }

  return ["filesystem.picker.searchLimitation"];
}
