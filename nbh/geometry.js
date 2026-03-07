// isPointInPoly adapted by Jonas Raoni Soares Silva
// (http://jsfromhell.com/math/is-point-in-poly)
// from http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
// Points are GeoJSON-style [lon, lat] arrays.

function isPointInPoly(poly, pt){
    for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i][1] <= pt[1] && pt[1] < poly[j][1]) || (poly[j][1] <= pt[1] && pt[1] < poly[i][1]))
        && (pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])
        && (c = !c);
    return c;
}

// the below adapted by Isaac Hepworth (@isaach)
// from http://www.topcoder.com/tc?d1=tutorials&d2=geometry1&module=Static

// compute the dot product AB ⋅ BC
function dotProduct(pointA, pointB, pointC) {
	var ABx = pointB[0] - pointA[0], ABy = pointB[1] - pointA[1];
	var BCx = pointC[0] - pointB[0], BCy = pointC[1] - pointB[1];
	return ABx * BCx + ABy * BCy;
}

// compute the cross product AB x AC
function crossProduct(pointA, pointB, pointC) {
	var ABx = pointB[0] - pointA[0], ABy = pointB[1] - pointA[1];
	var ACx = pointC[0] - pointA[0], ACy = pointC[1] - pointA[1];
	return ABx * ACy - ABy * ACx;
}

// compute the distance from A to B
function distanceBetween(pointA, pointB) {
	return Math.sqrt((pointA[0] - pointB[0]) * (pointA[0] - pointB[0])
					+ (pointA[1] - pointB[1]) * (pointA[1] - pointB[1]));
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

// Closest point on segment AB to point C, as [lon, lat].
// Longitude is scaled by cos(lat) before projecting so the result is
// geometrically correct at city scale.
function closestPointOnSegment(A, B, C) {
	var cosLat = Math.cos((A[1] + B[1] + C[1]) / 3 * Math.PI / 180);
	var ax = A[0] * cosLat, ay = A[1];
	var bx = B[0] * cosLat, by = B[1];
	var cx = C[0] * cosLat, cy = C[1];
	var dx = bx - ax, dy = by - ay;
	var lenSq = dx*dx + dy*dy;
	if (lenSq === 0) return A;
	var t = Math.max(0, Math.min(1, ((cx-ax)*dx + (cy-ay)*dy) / lenSq));
	return [A[0] + t*(B[0] - A[0]), A[1] + t*(B[1] - A[1])];
}

// Compass bearing from pt1 to pt2, in degrees clockwise from north
function bearingDeg(pt1, pt2) {
	var lat1 = pt1[1] * Math.PI / 180, lat2 = pt2[1] * Math.PI / 180;
	var dlam = (pt2[0] - pt1[0]) * Math.PI / 180;
	var y = Math.sin(dlam) * Math.cos(lat2);
	var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlam);
	return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function bearingTo(pt1, pt2) {
	var dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
	return dirs[Math.round(bearingDeg(pt1, pt2) / 45) % 8];
}

// Haversine distance between two [lon, lat] points, returns miles
function haversineDistance(pt1, pt2) {
	var R = 3958.8;
	var phi1 = pt1[1] * Math.PI / 180, phi2 = pt2[1] * Math.PI / 180;
	var dphi = (pt2[1] - pt1[1]) * Math.PI / 180;
	var dlam = (pt2[0] - pt1[0]) * Math.PI / 180;
	var a = Math.sin(dphi/2) * Math.sin(dphi/2) +
	        Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam/2) * Math.sin(dlam/2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
