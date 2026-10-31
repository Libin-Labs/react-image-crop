import { createElement } from 'react';
import { ImageCrop, exportCrop, type Crop, type ImageCropProps } from '@lp-labs/react-image-crop';

const value: Crop = { x: 0, y: 0, width: 10, height: 10 };
const props: ImageCropProps = { src: 'image.png', value, onChange: () => {} };
createElement(ImageCrop, props);
const save = (image: HTMLImageElement): Promise<Blob> => exportCrop(image, value);
void save;
