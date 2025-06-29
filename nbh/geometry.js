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
