// Find which neighborhood a point is in, across all cities.
// cities: [{name, neighborhoods}]
// pt: {x: lon, y: lat}
// Returns {city, neighborhood} or null.
function findLocation(cities, pt) {
	for (var i = 0; i < cities.length; i++) {
		var hoods = cities[i].neighborhoods;
		for (var j = 0; j < hoods.length; j++) {
			if (isPointInPoly(hoods[j].boundary_points, pt)) {
				return { city: cities[i].name, neighborhood: hoods[j].name };
			}
		}
	}
	return null;
}

// Distance from pt to the nearest boundary vertex of hood, in degree-space.
// Used only for ranking; not displayed directly.
function distanceToNeighborhoodDeg(hood, pt) {
	if (isPointInPoly(hood.boundary_points, pt)) return 0;
	var best = Infinity;
	for (var i = 0; i < hood.boundary_points.length - 1; i++) {
		var d = linePointDistance(hood.boundary_points[i], hood.boundary_points[i + 1], pt, true);
		if (d < best) best = d;
	}
	return best;
}

// Find the closest neighborhood not containing pt, across all cities.
// Returns {city, name, miles} or null.
function closestLocation(cities, pt) {
	var bestCity = null, bestName = null, bestHood = null, bestDeg = Infinity;
	for (var i = 0; i < cities.length; i++) {
		var hoods = cities[i].neighborhoods;
		for (var j = 0; j < hoods.length; j++) {
			if (isPointInPoly(hoods[j].boundary_points, pt)) continue;
			var d = distanceToNeighborhoodDeg(hoods[j], pt);
			if (d < bestDeg) {
				bestDeg = d;
				bestCity = cities[i].name;
				bestName = hoods[j].name;
				bestHood = hoods[j];
			}
		}
	}
	if (!bestHood) return null;
	// Compute display distance and bearing: haversine to nearest point on any boundary segment
	var miles = Infinity, closestPt = null;
	var bp = bestHood.boundary_points;
	for (var k = 0; k < bp.length; k++) {
		var p = closestPointOnSegment(bp[k], bp[(k+1) % bp.length], pt);
		var m = haversineDistance(pt, p);
		if (m < miles) { miles = m; closestPt = p; }
	}
	var deg = bearingDeg(pt, closestPt);
	var dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
	return {
		city: bestCity, name: bestName, miles: miles,
		direction: dirs[Math.round(deg / 45) % 8],
		debugDeg: deg, debugPt: closestPt
	};
}
