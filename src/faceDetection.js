const cv = require('opencv4nodejs');

exports.detectFaces = (image, thick, color) => {
	const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2);
	const { objects, numDetections } = classifier.detectMultiScale(image.bgrToGray());
	
	if (!objects.length) {
		console.error("No faces found in image");
		return false;
	}
	
	const numDetectionsTh = 10;
	objects.forEach((rect, i) => {
		const borderColor = color || new cv.Vec(255, 0, 0);
		let thickness = thick || 2;
		if (numDetections[i] < numDetectionsTh) { thickness = 1; }
		
		image.drawRectangle(
			new cv.Point(rect.x, rect.y),
			new cv.Point(rect.x + rect.width, rect.y + rect.height),
			borderColor,
			{ thickness }
		);
	});
	
	return image;
}
