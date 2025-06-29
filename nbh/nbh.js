
function findNeighborhood(hoods, pt) {
	for (var i=0; i<hoods.length; i++) {
		console.log("checking for containment: " + hoods[i].name);
		if (isPointInPoly(hoods[i].boundary_points, pt)) {
			console.log("yay");
			return hoods[i]["name"];
		}
	}
	return null;
}

function distanceToNeighborhood(hood, pt) {
	if (isPointInPoly(hood.boundary_points, pt)) return 0;
	var result = 1000000; // FIXME
	var distance;
	for (var i=0; i<hood.boundary_points.length-1; i++) {
		distance = linePointDistance(hood.boundary_points[i], hood.boundary_points[i+1],pt,true);
		if (distance < result) result = distance;
	}
	return result;
}

function closestNeighborhood(hoods, pt) {
	var result = {};
	var closest_distance = 1000000; // FIXME
	var distance;
	for (var i=0; i<hoods.length; i++) {
		if (isPointInPoly(hoods[i].boundary_points, pt)) {
			console.log("skipping containing neighborhood " + hoods[i]["name"]);
			continue;		
		}
		distance = distanceToNeighborhood(hoods[i], pt);
		console.log("distance to " + hoods[i]["name"] + " is " + Math.round(58.84 * distance * 100)/100 + " miles");
		if (distance < closest_distance) {
			closest_distance = distance;
			result = { name: hoods[i]["name"], distance: 58.84 * distance };
			console.log("currently closest: " + result + " is " + distance);
		}
	}
	return result;
}
