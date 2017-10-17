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
		let image = require('path').resolve('.', './dist/result.jpg');
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
				let name = '';
				let amount = 0;
				let amountNoD = 0;
				resultOrError.lines.forEach( (ln, n) => {
					if ( n < 2 ){
						name += ln.text.replace(/(\r|\n)/, '') + (n == 1 ? '' : ', ');
					}
					else {
						if (ln.text.match( /\$( |\t)[0-9,\.]*/ )){
							let num = Number(ln.text.match( /\$( |\t)[0-9,\.]*/ )[0].replace('$','').trim())
							amount = num > amount ? num : amount;
						}
						else if (ln.text.match( /total[^0-9]*[0-9,\.]*/i )){
							let num = Number(ln.text.match( /t(o|0)tal[^0-9]*[0-9,\.]*/i )[0].replace(/[^0-9,\.]/i,'').trim())
							amountNoD = num > amountNoD ? num : amountNoD;
						}
					}
				});
				let res = amount !== 0 && !isNaN(amount) ? amount : (amountNoD !== 0 ? amountNoD : false)
				console.log(name);
				console.log(res !== false ? ('$ '+res) : "Couldn't find amount");

				//console.log("Finished in: " + (((new Date()).getTime() - initTime) / 1000) + " seconds\n")
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
