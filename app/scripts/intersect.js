// The main function that returns true if line segment 'p1q1'
// and 'p2q2' intersect.
function doIntersect(p1, q1, p2, q2)
{
	'use strict';
	// Given three colinear points p, q, r, the function checks if
	// point q lies on line segment 'pr'
	function onSegment(p, q, r)
	{
		if (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
			q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)) {
		   return true;
		} else {
			return false;
		}
	}

	// To find orientation of ordered triplet (p, q, r).
	// The function returns following values
	// 0 --> p, q and r are colinear
	// 1 --> Clockwise
	// 2 --> Counterclockwise
	function orientation(p, q, r)
	{
		// See 10th slides from following link for derivation of the formula
		// http://www.dcs.gla.ac.uk/~pat/52233/slides/Geometry1x1.pdf
		var val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);

		if (val === 0) {
			return 0;  // colinear
		} else if(val > 0) {
			return 1; // clockwise
		} else {
			return 2; // counterclock wise
		}	
	}
	
    // Find the four orientations needed for general and
    // special cases
    var o1 = orientation(p1, q1, p2),
		o2 = orientation(p1, q1, q2),
		o3 = orientation(p2, q2, p1),
		o4 = orientation(p2, q2, q1),
		intersect = false;

    // General case
    if (o1 !== o2 && o3 !== o4) {
        intersect = true;
	}
	
    // Special Cases
    // p1, q1 and p2 are colinear and p2 lies on segment p1q1
    if (o1 === 0 && onSegment(p1, p2, q1)) {
		intersect = true;
	} else

    // p1, q1 and p2 are colinear and q2 lies on segment p1q1
    if (o2 === 0 && onSegment(p1, q2, q1))  {
		intersect = true;
	} else

    // p2, q2 and p1 are colinear and p1 lies on segment p2q2
    if (o3 === 0 && onSegment(p2, p1, q2)) {
		intersect = true;
	} else

     // p2, q2 and q1 are colinear and q1 lies on segment p2q2
    if (o4 === 0 && onSegment(p2, q1, q2)) {
		intersect = true;
	}

    return intersect;
	
}