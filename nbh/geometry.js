// isPointInPoly adapted by Jonas Raoni Soares Silva
// (http://jsfromhell.com/math/is-point-in-poly)
// from http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

function isPointInPoly(poly, pt){
    for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
        && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
        && (c = !c);
    return c;
}

// the below adapted by Isaac Hepworth (@isaach)
// from http://www.topcoder.com/tc?d1=tutorials&d2=geometry1&module=Static

// compute the dot product AB ⋅ BC
function dotProduct(pointA, pointB, pointC) {
	var AB = BC = {};
	AB.x = pointB.x - pointA.x;
	AB.y = pointB.y - pointA.y;
	BC.x = pointC.x - pointB.x;
	BC.y = pointC.y - pointB.y;
	return AB.x * BC.x + AB.y * BC.y;
}

// compute the cross product AB x AC
function crossProduct(pointA, pointB, pointC) {
	var AB = AC = {};
	AB.x = pointB.x - pointA.x;
	AB.y = pointB.y - pointA.y;
	AC.x = pointC.x - pointA.x;
	AC.y = pointC.y - pointA.y;
	return AB.x * AC.y - AB.y * AC.x;
}

// compute the distance from A to B
function distanceBetween(pointA, pointB) {
	return Math.sqrt((pointA.x - pointB.x) * (pointA.x - pointB.x)
					+ (pointA.y - pointB.y) * (pointA.y - pointB.y));
}

// compute the distance from AB to C
// (if isSegment is true, AB is a segment, not a line)
function linePointDistance(pointA, pointB, pointC, isSegment) {
 	var dist = crossProduct(pointA, pointB, pointC) / distanceBetween(pointA, pointB);
	if (isSegment) {
		if (dotProduct(pointA, pointB, pointC) > 0) return distanceBetween(pointB, pointC);
		if (dotProduct(pointB, pointA, pointC) > 0) return distanceBetween(pointA, pointC);
	}
	return Math.abs(dist);
}

// Compass bearing from pt1 to pt2, as a cardinal/intercardinal string
function bearingTo(pt1, pt2) {
	var lat1 = pt1.y * Math.PI / 180, lat2 = pt2.y * Math.PI / 180;
	var dlam = (pt2.x - pt1.x) * Math.PI / 180;
	var y = Math.sin(dlam) * Math.cos(lat2);
	var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlam);
	var deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
	var dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
	return dirs[Math.round(deg / 45) % 8];
}

// Haversine distance between two {x: lon, y: lat} points, returns miles
function haversineDistance(pt1, pt2) {
	var R = 3958.8;
	var phi1 = pt1.y * Math.PI / 180, phi2 = pt2.y * Math.PI / 180;
	var dphi = (pt2.y - pt1.y) * Math.PI / 180;
	var dlam = (pt2.x - pt1.x) * Math.PI / 180;
	var a = Math.sin(dphi/2) * Math.sin(dphi/2) +
	        Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam/2) * Math.sin(dlam/2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
