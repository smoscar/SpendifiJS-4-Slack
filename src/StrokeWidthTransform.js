const cv = require('opencv4nodejs');
const PI = 3.14159265;
									 
const normalizeImage = (input, output) => {
	if (input.depth != cv.CV_32F || input.channels != 1 || output.depth != cv.CV_32F || output.channels != 1 ){
		console.error("Error on input/output");
		return false;
	}
	
	let maxVal = 0;
	let minVal = 1e100;
	for ( let row = 0; row < input.rows; row++ ){
		for (let col = 0; col < input.cols; col++){
			let ptr = input.at(row, col);
			if (!(ptr < 0)){
				maxVal = Math.max(ptr, maxVal);
				minVal = Math.min(ptr, minVal);
			}
		}
	}
	
	let difference = maxVal - minVal;
	for ( let row = 0; row < input.rows; row++ ){
		for (let col = 0; col < input.cols; col++){
			const ptrin = input.at(row, col);
			if (ptrin < 0) {
				output.set( row, col, 1 );
			}
			else {
				output.set( row, col, ( ( ptrin ) - minVal ) / difference );
			}
		}
	}
}

const strokeWidthTransform = (edgeImage, gradientX, gradientY, darkOnLight, SWTImage, rays) => {
	let prec = 0.05;
	for (let row = 0; row < edgeImage.rows; row++){
		for (let col = 0; col < edgeImage.cols; col++){
			let ptr = edgeImage.at(row, col);
			if (ptr > 0){
				let points = [];
				let p = { "x": col, "y": row };
				let r = {"p": p};
				points.push(p);
				
				let curX = col + 0.5;
				let curY = row + 0.5;
				let curPixX = col;
				let curPixY = row;
				let G_x = gradientX.at(row, col);
				let G_y = gradientY.at(row, col);
				//Normalize gradient
				let mag = Math.sqrt( (G_x * G_x) + (G_y * G_y) );
				if (darkOnLight){
					G_x = -G_x/mag;
					G_y = -G_y/mag;
				}
				else {
					G_x = G_x/mag;
					G_y = G_y/mag;
				}
				
				while (true){
					curX += G_x*prec;
					curY += G_y*prec;
					if (parseInt(Math.floor(curX)) != curPixX || parseInt(Math.floor(curY)) != curPixY) {
						curPixX = parseInt(Math.floor(curX));
						curPixY = parseInt(Math.floor(curY));
						// check if pixel is outside boundary of image
						if (curPixX < 0 || (curPixX >= SWTImage.cols) || curPixY < 0 || (curPixY >= SWTImage.rows)) {
							break;
						}
						let pnew = { "x": curPixX, "y": curPixY };
						points.push(pnew);
						
						if (edgeImage.at(curPixY, curPixX) > 0) {
							r.q = pnew;
							// dot product
							let G_xt = gradientX.at(curPixY,curPixX);
							let G_yt = gradientY.at(curPixY,curPixX);
							mag = Math.sqrt( (G_xt * G_xt) + (G_yt * G_yt) );
							if (darkOnLight){
								G_xt = -G_xt/mag;
								G_yt = -G_yt/mag;
							}
							else {
								G_xt = G_xt/mag;
								G_yt = G_yt/mag;
							}
							
							if ( Math.acos(G_x * -G_xt + G_y * -G_yt) < PI/2.0 ){
								let length = Math.sqrt( ( r.q.x - r.p.x ) * ( r.q.x - r.p.x ) + ( r.q.y - r.p.y ) * ( r.q.y - r.p.y ) );
								points.forEach( pit => {
									if (SWTImage.at(pit.y, pit.x) < 0) {
										SWTImage.set(pit.y, pit.x, length);
									}
									else {
										SWTImage.set(pit.y, pit.x, Math.min(length, SWTImage.at(pit.y, pit.x)));
									}
								});
								r.points = points;
								rays.push(r);
							}
							break;
						}
					}
				}
			}
		}
	}
}

const Point2dSort = (lhs, rhs) => lhs.SWT < rhs.SWT;

const SWTMedianFilter = (SWTImage, rays) => {
	rays.forEach( (_, t, ri) => {
		ri[t].points.forEach( (_, it, p) => {
			p[it].SWT = SWTImage.at(p[it].y, p[it].x);
		})
		ri[t].points.sort( Point2dSort );

		let median = ri[t].points[ parseInt(ri[t].points.length / 2) ].SWT;
		ri[t].points.forEach( pit => {
			SWTImage.set( pit.y, pit.x, Math.min(pit.SWT, median) );
		});
	});
}

const addEdge = (u, v, g, ght) => {
	g[ u ] = typeof( g[ u ] ) == "undefined" ? [] : g[ u ];
	ght[ u ] = typeof( ght[ u ] ) == "undefined" ? {} : ght[ u ];
	
	g[ v ] = typeof( g[ v ] ) == "undefined" ? [] : g[ v ];
	ght[ v ] = typeof( ght[ v ] ) == "undefined" ? {} : ght[ v ];
	
	if ( ght[ u ][ v ] != true ){
		g[ u ].push( v );
		ght[ u ][ v ] = true;
	}
	if ( ght[ v ][ u ] != true ){
		g[ v ].push( u );
		ght[ v ][ u ] = true;
	}
}

const connected_components = (g, c) => {
	if (g.length == 0) { return 0; }
	let visited = new Set();
	let c_count = 0;
	
	//Non recursive implementation of Depth First Traversal
	const dfsUtil = v => {
		let stack = [];
		stack.push(v);
		while (stack.length > 0){
			let s = stack.pop();
			
			if (!visited.has(s)){
				c[s] = c_count;
				visited.add(s);
			}
			
			for (let i of g[s]){
				if (!visited.has(i)) {
					stack.push(i);
				}
			}
		}
	};
	
	//Gather every connected component
	for (let u in g){
		if (!visited.has(parseInt(u))){
			visited.add(parseInt(u));
			c[parseInt(u)] = c_count;
			dfsUtil(parseInt(u));
			c_count++
		}
	}
	
	return c_count;
}

const findLegallyConnectedComponents = ( SWTImage, rays ) => {
	let map = {};
	let revmap = {};
	
	let num_vertices = 0;
	// Number vertices for graph. Associate each point with number
	for( let row = 0; row < SWTImage.rows; row++ ){
		for (let col = 0; col < SWTImage.cols; col++ ){
			let ptr = SWTImage.at(row, col);
			if (ptr > 0){
				map[row * SWTImage.cols + col] = num_vertices;
				let p = {x: col, y: row};
				revmap[num_vertices] = p;
				num_vertices++;
			}
		}
	}
	
	let g = [];
	let ght = {};
	for( let row = 0; row < SWTImage.rows; row++ ){
		for (let col = 0; col < SWTImage.cols; col++ ){
			let ptr = SWTImage.at(row, col);
			if (ptr > 0){
				// check pixel to the right, right-down, down, left-down
				let this_pixel = map[row * SWTImage.cols + col];
				if (col+1 < SWTImage.cols) {
					let right = SWTImage.at( row, col+1 );
					if ( right > 0 && ( ( ptr / right ) <= 3.0 && ( right / ptr ) <= 3.0 ) ){
						addEdge(this_pixel, map[ row * SWTImage.cols + col + 1 ], g, ght);
					}
				}
				
				if (row+1 < SWTImage.rows) {
					if (col+1 < SWTImage.cols) {
						let right_down = SWTImage.at( row+1, col+1 );
						if ( right_down > 0 && ( ( ptr / right_down ) <= 3.0 && ( right_down / ptr ) <= 3.0 ) ) {
							addEdge(this_pixel, map[ (row+1) * SWTImage.cols + col + 1 ], g, ght);
						}
						let down = SWTImage.at(row+1, col);
						if ( down > 0 && ( ( ptr / down ) <= 3.0 && ( down / ptr ) <= 3.0 ) ){
							addEdge(this_pixel, map[ (row+1) * SWTImage.cols + col ], g, ght);
						}
						if (col-1 >= 0) {
							let left_down = SWTImage.at( row+1, col-1 );
							if (left_down > 0 && ( ( ptr / left_down ) <= 3.0 && ( left_down / ptr ) <= 3.0 ) ) {
								addEdge(this_pixel, map[ (row+1) * SWTImage.cols + col - 1 ], g, ght);
							}
						}
					}
				}
			}
		}
	}
	
	let c = [];
	let num_comp = connected_components( g, c );
	
	let components = []
	for (let j = 0; j < num_comp; j++) {
		components.push([]);
	}
	for (let j = 0; j < num_vertices; j++) {
		let p = revmap[j];
		if (typeof c[j] !== "undefined"){
			components[c[j]].push(p);
		}
	}
	
	return components
}

const componentStats = (SWTImage, component) => {
	let temp = [];
	let mean = 0;
	let variance = 0;
	let minx = 1000000;
	let miny = 1000000;
	let maxx = 0;
	let maxy = 0;
	let median;
	component.forEach( it => {
		let t = SWTImage.at(it.y, it.x);
		mean += t;
		temp.push(t);
		miny = Math.min(miny, it.y);
		minx = Math.min(minx, it.x);
		maxy = Math.max(maxy, it.y);
		maxx = Math.max(maxx, it.x);
	});
	mean = mean / component.length;
	temp.forEach( it => {
		variance += (it - mean) * (it - mean);
	});
	variance = variance / component.length;
	temp.sort( (a, b) => a-b );
	median = temp[ parseInt( temp.length/2 ) ];
	
	return [mean, variance, median, minx, miny, maxx, maxy];
}

const filterComponents = (SWTImage, components) => {
	let validComponents = [];
	let compCenters = [];
	let compMedians = [];
	let compDimensions = [];
	let compBB = [];
	let cropRect = { x1:1000000, y1:1000000, x2:-1000000, y2:-1000000 };
	
	for( let it = 0; it < components.length; it++ ){
		// compute the stroke width mean, variance, median
		let mean, variance, median;
		let minx, miny, maxx, maxy;
		[mean, variance, median, minx, miny, maxx, maxy] = componentStats(SWTImage, components[it]);
		
		// check if variance is less than half the mean
		if (variance > 0.5 * mean) {
			continue;
		}
		
		let length = maxx - minx + 1;
		let width = maxy - miny + 1;
		
		// check font height
		if (width > 300) {
			continue;
		}
		
		let area = length * width;
		let rminx = minx;
		let rmaxx = maxx;
		let rminy = miny;
		let rmaxy = maxy;
		// compute the rotated bounding box
		let increment = 1./36.;
		for (let theta = increment * PI; theta<PI/2.0; theta += increment * PI) {
			let xmin, xmax, ymin, ymax, xtemp, ytemp, ltemp, wtemp;
			xmin = 1000000;
			ymin = 1000000;
			xmax = 0;
			ymax = 0;
			for (let i = 0; i < components[it].length; i++) {
				xtemp = components[it][i].x * Math.cos(theta) + components[it][i].y * -Math.sin(theta);
				ytemp = components[it][i].x * Math.sin(theta) + components[it][i].y * Math.cos(theta);
				xmin = Math.min( xtemp, xmin );
				xmax = Math.max( xtemp, xmax );
				ymin = Math.min( ytemp, ymin );
				ymax = Math.max( ytemp, ymax );
			}
			ltemp = xmax - xmin + 1;
			wtemp = ymax - ymin + 1;
			if ( ltemp * wtemp < area) {
				area = ltemp * wtemp;
				length = ltemp;
				width = wtemp;
			}
		}
		// check if the aspect ratio is between 1/10 and 10
		if ( length / width < 1./10. || length / width > 10.) {
			continue;
		}
		
		// compute the diameter TODO finish
		// compute dense representation of component
		/*let denseRepr = [];
		for (let i = 0; i < maxx - minx + 1; i++) {
			let tmp = [];
			denseRepr.push(tmp);
			for (let j = 0; j < maxy - miny + 1; j++) {
				denseRepr[i].push(0);
			}
		}
		components[it].forEach( pit => {
			(denseRepr[pit.x - minx])[pit.y - miny] = 1;
		});*/
		let center = { x: (( maxx + minx ) / 2.0), y: (( maxy + miny ) / 2.0) };
		let dimensions = { x: ( maxx - minx + 1 ), y: ( maxy - miny + 1 ) };
		let bb1 = { x: minx, y: miny };
		let bb2 = { x: maxx, y: maxy };
		let pair = [ bb1, bb2 ];
		
		cropRect.x1 = minx < cropRect.x1 ? minx : cropRect.x1;
		cropRect.y1 = miny < cropRect.y1 ? miny : cropRect.y1;
		cropRect.x2 = maxx > cropRect.x2 ? maxx : cropRect.x2;
		cropRect.y2 = maxy > cropRect.y2 ? maxy : cropRect.y2;
		
		compBB.push(pair);
		compDimensions.push(dimensions);
		compMedians.push(median);
		compCenters.push(center);
		validComponents.push( components[it] );
	}
	let tempComp = [];
	let tempDim = [];
	let tempMed = [];
	let tempCenters = [];
	let tempBB = [];
	for (let i = 0; i < validComponents.length; i++) {
		let count = 0;
		for (let j = 0; j < validComponents.length; j++) {
			if (i != j) {
				if (compBB[i][0].x <= compCenters[j].x && compBB[i][1].x >= compCenters[j].x &&
						compBB[i][0].y <= compCenters[j].y && compBB[i][1].y >= compCenters[j].y) {
					count++;
				}
			}
		}
		if (count < 2) {
			tempComp.push( validComponents[i] );
			tempCenters.push( compCenters[i] );
			tempMed.push( compMedians[i] );
			tempDim.push( compDimensions[i] );
			tempBB.push( compBB[i] );
		}
	}
	validComponents = tempComp;
	compDimensions = tempDim;
	compMedians = tempMed;
	compCenters = tempCenters;
	compBB = tempBB;
	
	return [validComponents, compCenters, compMedians, compDimensions, compBB];
}

const renderComponents = (SWTImage, components, output) => {
	for ( let row = 0; row < output.rows; row++ ){
		for ( let col = 0; col < output.cols; col++ ){
			output.set(row, col, 0);
		}
	}
	
	components.forEach( component => {
		component.forEach( pit => {
			output.set( pit.y, pit.x, SWTImage.at(pit.y, pit.x) );
		});
	});
	
	for ( let row = 0; row < output.rows; row++ ) {
		for ( let col = 0; col < output.cols; col++ ) {
			let ptr = output.at(row, col);
			if (ptr == 0){
				output.set(row, col, -1);
			}
		}
	}
	
	let maxVal = 0;
	let minVal = 1e100;
	
	for ( let row = 0; row < output.rows; row++ ) {
		for ( let col = 0; col < output.cols; col++ ) {
			let ptr = output.at(row, col);
			if (ptr != 0){
				maxVal = Math.max(ptr, maxVal);
				minVal = Math.min(ptr, minVal);
			}
		}
	}
	
	let difference = maxVal - minVal;
	
	for ( let row = 0; row < output.rows; row++ ) {
		for ( let col = 0; col < output.cols; col++ ) {
			let ptr = output.at(row, col);
			if (ptr < 1){
				output.set(row, col, 1);
			}
			else {
				output.set(row, col, ( ( ptr - minVal ) / difference));
			}
		}
	}
}
	
const renderComponentsWithBoxes = (SWTImage, components, compBB) => {
	let output = new cv.Mat( SWTImage.rows, SWTImage.cols, cv.CV_8UC3 );
	let outTemp = new cv.Mat( output.rows, output.cols, cv.CV_32FC1 );
	
	renderComponents(SWTImage, components, outTemp);
	
	let bb = [];
	compBB.forEach( it => {
		let p0 = [it[0].x, it[0].y];
		let p1 = [it[1].x, it[1].y];
		bb.push([p0, p1]);
	});
	
	let out = outTemp.convertTo(cv.CV_32FC1, 255.);
	output = out.cvtColor( cv.COLOR_GRAY2RGB );

	bb.forEach( (it,n) => {
		const borderColor = new cv.Vec(255, 0, 0);
		let thickness = 2;
		output.drawRectangle(
			new cv.Point(it[0][0], it[0][1]),
			new cv.Point(it[1][0], it[1][1]),
			borderColor,
			{ thickness }
		);
	});
	
	return output;
}

const sharesOneEnd = ( c0, c1 ) => {
	if ( c0.p == c1.p || c0.p == c1.q || c0.q == c1.q || c0.q == c1.p ) {
		return true;
	}
	else {
		return false;
	}
}

const chainSortDist = ( lhs, rhs ) => lhs.dist < rhs.dist;
const chainSortLength = ( lhs, rhs ) => lhs.components.length > rhs.components.length;

const makeChains = (colorImage, components, compCenters, compMedians, compDimensions, compBB) => {
	if (compCenters.length !== components.length) {
		console.error("Error on arguments");
		return false;
	}
	// make vector of color averages
	let colorAverages = [];
	components.forEach( it => {
		let mean = {x: 0, y: 0, z: 0};
		let num_points = 0;
		it.forEach( pit => {
			mean.x += ( colorImage.at(pit.y, pit.x) ).x;
			mean.y += ( colorImage.at(pit.y, pit.x) ).y;
			mean.z += ( colorImage.at(pit.y, pit.x) ).z;
			num_points++;
		});
		mean.x = mean.x / num_points;
		mean.y = mean.y / num_points;
		mean.z = mean.z / num_points;
		colorAverages.push(mean);
	});
	
	// form all eligible pairs and calculate the direction of each
	let chains = [];
	for (let i = 0; i < components.length; i++){
		for (let j = i + 1; j < components.length; j++){
			// TODO add color metric
			if ( ( compMedians[i] / compMedians[j] <= 2.0 || compMedians[j] / compMedians[i] <= 2.0 ) &&
					( compDimensions[i].y / compDimensions[j].y <= 2.0 || compDimensions[j].y / compDimensions[i].y <= 2.0 ) ) {
				
				let dist = ( compCenters[i].x - compCenters[j].x ) * ( compCenters[i].x - compCenters[j].x ) +
									 ( compCenters[i].y - compCenters[j].y ) * ( compCenters[i].y - compCenters[j].y );
				let colorDist = ( colorAverages[i].x - colorAverages[j].x ) * ( colorAverages[i].x - colorAverages[j].x ) +
												( colorAverages[i].y - colorAverages[j].y ) * ( colorAverages[i].y - colorAverages[j].y ) +
												( colorAverages[i].z - colorAverages[j].z ) * ( colorAverages[i].z - colorAverages[j].z );

				if ( dist < 9 * ( Math.max( Math.min( compDimensions[i].x, compDimensions[i].y ), Math.min( compDimensions[j].x, compDimensions[j].y ) ) )
						 * ( Math.max( Math.min( compDimensions[i].x, compDimensions[i].y ), Math.min( compDimensions[j].x, compDimensions[j].y ) ) )
						&& colorDist < 1600) {
							
					let c = { p: i, q: j, dist: dist, merged: false, direction: null, components: [] };
					let comps = [];
					comps.push( c.p );
					comps.push( c.q );
					c.components = comps;
					let d_x = ( compCenters[i].x - compCenters[j].x );
					let d_y = ( compCenters[i].y - compCenters[j].y );
					let mag = Math.sqrt( d_x*d_x + d_y*d_y );
					d_x = d_x / mag;
					d_y = d_y / mag;
					let dir = { x: d_x, y: d_y };
					c.direction = dir;
					chains.push( c );
				}
			}
		}
	}
	chains.sort( chainSortDist );
	
	let strictness = 0;
	//merge chains
	let merges = 1;
	while ( merges > 0 ) {
		for ( let i = 0; i < chains.length; i++ ) {
			chains[i].merged = false;
		}
		merges = 0;
		let newchains = [];
		for ( let i = 0; i < chains.length; i++ ) {
			for ( let j = 0; j < chains.length; j++ ) {
				if ( i != j ) {
					if ( !chains[i].merged && !chains[j].merged && sharesOneEnd( chains[i], chains[j] ) ) {
						if ( chains[i].p == chains[j].p ) {
							if ( Math.acos( chains[i].direction.x * -chains[j].direction.x + chains[i].direction.y * -chains[j].direction.y ) < strictness ) {
								
								chains[i].p = chains[j].q;
								components.forEach( it => {
									chains[i].components.push( it );
								});
								let d_x = ( compCenters[chains[i].p].x - compCenters[chains[i].q].x );
								let d_y = ( compCenters[chains[i].p].y - compCenters[chains[i].q].y );
								chains[i].dist = d_x * d_x + d_y * d_y;
								
								let mag = Math.sqrt( d_x * d_x + d_y * d_y );
								d_x = d_x / mag;
								d_y = d_y / mag;
								let dir = { x: d_x, y: d_y };
								chains[i].direction = dir;
								chains[j].merged = true;
								merges++;
							}
						}
						else if ( chains[i].p == chains[j].q ) {
							if ( Math.acos( chains[i].direction.x * chains[j].direction.x + chains[i].direction.y * chains[j].direction.y ) < strictness ) {
								
								chains[i].p = chains[j].p;
								components.forEach( it => {
									chains[i].components.push( it );
								});
								let d_x = ( compCenters[chains[i].p].x - compCenters[chains[i].q].x );
								let d_y = ( compCenters[chains[i].p].y - compCenters[chains[i].q].y );
								chains[i].dist = d_x * d_x + d_y * d_y;
								
								let mag = Math.sqrt( d_x * d_x + d_y * d_y );
								d_x = d_x / mag;
								d_y = d_y / mag;
								let dir = { x: d_x, y: d_y };
								chains[i].direction = dir;
								chains[j].merged = true;
								merges++;
							}
						}
						else if ( chains[i].q == chains[j].p ) {
							if ( Math.acos( chains[i].direction.x * chains[j].direction.x + chains[i].direction.y * chains[j].direction.y ) < strictness) {
								
								chains[i].q = chains[j].q;
								components.forEach( it => {
									chains[i].components.push( it );
								});
								let d_x = ( compCenters[chains[i].p].x - compCenters[chains[i].q].x );
								let d_y = ( compCenters[chains[i].p].y - compCenters[chains[i].q].y );
								chains[i].dist = d_x * d_x + d_y * d_y;
								
								let mag = Math.sqrt( d_x * d_x + d_y * d_y );
								d_x = d_x / mag;
								d_y = d_y / mag;
								let dir = { x: d_x, y: d_y };
								chains[i].direction = dir;
								chains[j].merged = true;
								merges++;
							}
						}
						else if ( chains[i].q == chains[j].q ) {
							if ( Math.acos( chains[i].direction.x * -chains[j].direction.x + chains[i].direction.y * -chains[j].direction.y ) < strictness ) {
								
								chains[i].q = chains[j].p;
								components.forEach( it => {
									chains[i].components.push( it );
								});
								let d_x = ( compCenters[chains[i].p].x - compCenters[chains[i].q].x );
								let d_y = ( compCenters[chains[i].p].y - compCenters[chains[i].q].y );
								chains[i].dist = d_x * d_x + d_y * d_y;
								
								let mag = Math.sqrt( d_x * d_x + d_y * d_y );
								d_x = d_x / mag;
								d_y = d_y / mag;
								let dir = { x: d_x, y: d_y };
								chains[i].direction = dir;
								chains[j].merged = true;
								merges++;
							}
						}
					}
				}
			}
		}
		for ( let i = 0; i < chains.length; i++ ) {
			if ( !chains[i].merged ) {
				newchains.push( chains[i] );
			}
		}
		chains = newchains;
		chains.sort( chainSortLength )
	}
	
	let newchains = [];
	chains.forEach( cit => {
		if (cit.components.length >= 2) { //OSCAR
			newchains.push( cit );
		}
	});
	chains = newchains;
	return chains;
}

const renderChains = ( SWTImage, components, chains ) => {
	let included = [];
	for ( let i = 0; i != components.length; i++ ) {
		included.push( false );
	}
	chains.forEach( it => {
		it.components.forEach( cit => {
			included[ cit ] = true;
		});
	});
	let componentsRed = [];
	for ( let i = 0; i != components.length; i++ ) {
		if ( included[i] ) {
			componentsRed.push( components[i] );
		}
	}
	let outTemp = new cv.Mat( SWTImage.rows, SWTImage.cols, cv.CV_32FC1 );
	renderComponents(SWTImage, componentsRed, outTemp);
	let output = outTemp.convertTo( cv.CV_8UC1, 255. ); 
	
	return output
}

exports.textDetection = (input, darkOnLight) => {
	if (input.depth != cv.CV_8U || input.channels != 3 ){
		console.error("Error on input");
		return false;
	}

	const threshold_low = 175;
	const threshold_high = 320;
	const tolerance = 0.01;
	
	input = input.rescale(0.5);
	let grayImage = input.bgrToGray();
	let edgeImage = grayImage.canny(threshold_low, threshold_high, 3);
	let dilated = edgeImage.dilate( new cv.Mat(), new cv.Point(-1, -1) );
	let contours = dilated.findContours( cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE );
	let squares = [];
	let minX = 1000000;
	let minY = 1000000;
	let maxX = 0;
	let maxY = 0;
	let square;
	
	// Get biggest square found in image and crop edgeImage around it
	contours.sort( (a, b) => b.area - a.area );
	square = contours[0].approxPolyDP( contours[0].arcLength( true )*0.02, true );
	
	square.forEach( p => {
		minX = p.x < minX ? p.x : minX;
		minY = p.y < minY ? p.y : minY;
		maxX = p.x > maxX ? p.x : maxX;
		maxY = p.y > maxY ? p.y : maxY;
	});
	edgeImage = edgeImage.getRegion( new cv.Rect( minX, minY, (maxX - minX), (maxY - minY) ) );
	grayImage = grayImage.getRegion( new cv.Rect( minX, minY, (maxX - minX), (maxY - minY) ) );
	input = input.getRegion( new cv.Rect( minX, minY, (maxX - minX), (maxY - minY) ) );
	
	//cv.imwrite('./dist/canny.jpg', dilated);
	
	let gaussianImage = grayImage.convertTo(cv.CV_32FC1, 1./255.);
	gaussianImage = gaussianImage.gaussianBlur( new cv.Size(5, 5), 0 );
	
	let gradientX = gaussianImage.scharr(-1, 1, 0);
	let gradientY = gaussianImage.scharr(-1, 0, 1);
		
	gradientX = gradientX.gaussianBlur( new cv.Size(3, 3), 0 );
	gradientY = gradientY.gaussianBlur( new cv.Size(3, 3), 0 );
	
	let rays = [];
	let SWTImage = new cv.Mat( input.rows, input.cols, cv.CV_32FC1 );
	for (let row = 0; row < input.rows; row++){
		for (let col = 0; col < input.cols; col++){
			SWTImage.set(row, col, -1);
		}
	}
	
	strokeWidthTransform(edgeImage, gradientX, gradientY, darkOnLight, SWTImage, rays);
	SWTMedianFilter ( SWTImage, rays );
	
	let output2 = new cv.Mat( input.rows, input.cols, cv.CV_32FC1 );
	normalizeImage( SWTImage, output2 );
	let saveSWT = output2.convertTo( cv.CV_8UC1, 255 );
	//cv.imwrite('./dist/SWT.png', saveSWT);
	
	return saveSWT;
	
	//EXPERIMENTAL: Find components to remove potential non letters
	
	let components = findLegallyConnectedComponents( SWTImage, rays );
	
	// Filter the components
	let validComponents = [];
	let compCenters = [];
	let compMedians = [];
	let compDimensions = [];
	let compBB = [];
	[ validComponents, compCenters, compMedians, compDimensions, compBB ] = filterComponents( SWTImage, components );
	
	let output3 = renderComponentsWithBoxes(SWTImage, validComponents, compBB);
	cv.imwrite('./dist/components.png', output3);
	
	// Make chains of components
	let chains = makeChains( input, validComponents, compCenters, compMedians, compDimensions, compBB );
	let output4 = renderChains( SWTImage, validComponents, chains );
	
	let output5 = output4.cvtColor( cv.COLOR_GRAY2RGB );
	
	return output5;
}
