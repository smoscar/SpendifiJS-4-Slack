const cv = require('opencv4nodejs');
const SWT = require('./src/StrokeWidthTransform');

const loadByteImage = name => {
	let image;
	try {
		image = cv.imread(name);
		return image;
	}
	catch (e){
		return new cv.Mat();
	}
}

const mainTextDetection = args => {
	let byteQueryImage = loadByteImage(args[0]);
	
	if (byteQueryImage.empty) {
		console.error("Error while loading image");
		return false;
	}
	
	let output = SWT.textDetection(byteQueryImage, true);
	if (output){
		cv.imwrite('./dist/result.jpg', output);
	}
};

const args = process.argv.slice(2);

if (args.length !== 1){
	console.error("Usage: imagefile resultImage darkText");
	return false;
}

mainTextDetection(args);
