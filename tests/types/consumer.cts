import { createElement } from 'react';
import crop = require('@lp-labs/react-image-crop');

const value: crop.Crop = { x: 0, y: 0, width: 10, height: 10 };
createElement(crop.ImageCrop, { src: 'image.png', value, onChange: () => {} });
const save = (image: HTMLImageElement): Promise<Blob> => crop.exportCrop(image, value);
void save;
