const cv = require('opencv4nodejs');
const SWT = require('./src/StrokeWidthTransform');
const Tes = require('tesseract.js')

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
	let initTime = (new Date()).getTime();
	
	if (byteQueryImage.empty) {
		console.error("Error while loading image");
		return false;
	}
	
	let output = SWT.textDetection(byteQueryImage, true);
	if (output){
		cv.imwrite('./dist/result.jpg', output);
		let image = require('path').resolve('.', './dist/SWT.png');
		Tes.recognize(image, {lang: 'eng'})
			.progress(message => {
				//if (message.status == "recognizing text")
				//console.log(parseInt(message.progress*100)+"%")
			})
			.catch(err => console.error(err))
			.then(result => {
				//console.log("FINISHED!")
				//console.log(result.text)
			})
			.finally(resultOrError => {
				console.log(resultOrError.text);
				console.log("Finished in: " + (((new Date()).getTime() - initTime) / 1000) + " seconds\n")
				process.exit();
			});
	}
};

const args = process.argv.slice(2);

if (args.length !== 1){
	console.error("Usage: imagefile resultImage darkText");
	return false;
}

mainTextDetection(args);
