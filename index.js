const cv = require('opencv4nodejs');
const faces = require('./src/faceDetection');

const loadByteImage = name => {
	let image;
	try {
		image = cv.imread(name);
		image.cvtColor(cv.COLOR_BGR2RGBA);
		
		return image;
	}
	catch (e){
		return cv.Mat();
	}
}

const mainTextDetection = args => {
	let byteQueryImage = loadByteImage(args[0]),
			output;
	
	if (byteQueryImage.empty) {
		console.error("Error while loading image");
		return false;
	}
	
	output = faces.detectFaces(byteQueryImage, 2, new cv.Vec(255, 0, 0));
	
	if (output){
		cv.imwrite('./faces.jpg', output);
	}
};

const args = process.argv.slice(2);

if (args.length !== 1){
	console.error("Usage: imagefile resultImage darkText");
	return false;
}

mainTextDetection(args);
