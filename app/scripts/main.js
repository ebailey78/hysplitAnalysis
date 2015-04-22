/* jshint devel:true */

var bounds = L.latLngBounds([30.5, -89], [47, -70]), 
	  monIcon = L.divIcon({iconSize: 10, className: 'mon-icon'}),
	  trajStorageIcon = L.divIcon({iconSize: 10, className: 'traj-storage'}),
	  statesLayer, sites, map, chart, basemap, siteLayer,
	  trajLayer, trajPointLayer, trajPointStorage, selectedSites = {},
	  trajLock = false, activeReading = {};

// MAP STUFF //

// CHART SUPPORT FUNCTIONS //

function showHeightPlot(layers) {
	'use strict';
	var labels = [], values = [], hour = ['hour'];
			
	for(var i = 0; i <= 72; i++) {
		hour.push(i);
	}
	
	activeReading.site = layers[0].feature.properties.SITE_ID;
	activeReading.year = layers[0].feature.properties.year;
	activeReading.rank = layers[0].feature.properties.rank;
	activeReading.date = layers[0].feature.properties.date;
			
	layers.forEach(function(layer) {
	
		var lbl = String(layer.feature.properties.height);
		if(labels.indexOf(lbl) === -1) {
			labels.push(lbl);
			values.push([lbl]);
		}
		var i = labels.indexOf(lbl);
		layer.feature.geometry.coordinates.forEach(function(el) {values[i].push(el[2]);});
	
	});
				
	values.push(hour);
			
	chart.load({columns: values, unload: true});

}

// Trajectory Support Functions //

function trajHighlight(e, sel) {
	'use strict';
	var props = e.target.feature.properties;
	if(!$.isArray(sel)) {
		sel = [sel];
	}
	trajPointLayer.clearLayers();
	var plotLayers = [];
		
	trajLayer.eachLayer(function(layer) {
		
		var inc = true;
		
		for(var p in sel) {
			if(layer.feature.properties[sel[p]] !== props[sel[p]]) {
				inc = false;
			}
		}
		
		if(inc === true) {
			layer.setStyle({weight: 4, opacity: 1});
			plotLayers.push(layer);
		} else {
			layer.setStyle({weight: 1, opacity: 0.2});
		}
		
	});
	
	$('#site_id').html(props.SITE_ID);
	$('#date').html(props.date);
	$('#rank').html(props.rank);
	$('#conc').html(props.conc + ' ppb');
	$('#conc_hour').html(props.conc_hour);
	
	showHeightPlot(plotLayers);

}

function trajUnHighlight() {
	'use strict';
	trajLayer.eachLayer(function(layer) {
		layer.setStyle({weight: 3, opacity: 0.7});
	});
	trajPointLayer.clearLayers();
	chart.unload({ids: ['1000', '100', '10']});

}

function addTrajectory(obj) {
	'use strict';
	
	var selSites, selRanks, selYears;
	
	function addTraj(site, year, rank) {
	
		var url = 'data/trajectories/' + site + '_' + year + '_' + rank + '.geojson';
	
		$.ajax({
			dataType: 'json',
			url: url,
			success: function(data) {
				trajLayer.addData(data);	
				trajPointStorage.addData(data);
			}
		});
	
	}
		
	if(obj.hasOwnProperty('year')) {
		selSites = $('#monitors').select2('val');
		selRanks = $('input[name="rank[]"]:checked').map(function() {return $(this).val();}).get();
		selYears = [obj.year];
	}
	
	if(obj.hasOwnProperty('rank')) {
		selSites = $('#monitors').select2('val');
		selRanks = [obj.rank];
		selYears = $('input[name="year[]"]:checked').map(function() {return $(this).val();}).get();
	}
	
	if(obj.hasOwnProperty('SITE_ID')) {
		selSites = [obj.SITE_ID];
		selRanks = $('input[name="rank[]"]:checked').map(function() {return $(this).val();}).get();
		selYears = $('input[name="year[]"]:checked').map(function() {return $(this).val();}).get();
	}
	
	for(var year = 0; year < selYears.length; year++) {
		for(var rank = 0; rank < selRanks.length; rank++) {
			for(var site = 0; site < selSites.length; site++) {
			
				addTraj(selSites[site], selYears[year], selRanks[rank]);
			
			}
		}
	}
	
	map.fitBounds(trajLayer.getBounds());
	
}

function removeTrajectory(obj) {
	'use strict';
	var keys = Object.keys(obj), l, k;

	function trajRemove(val) {
		if(trajLayer._layers[l].feature.properties[keys[k]] === val) {
			trajLayer.removeLayer(trajLayer._layers[l]);
		}
	}		
	
	Object.keys(trajLayer._layers).forEach(function() {
	
		for(var k = 0; k < keys.length; k++) {
			obj[keys[k]].forEach(trajRemove);
		}

	});
	
	function trajPointRemove(val) {
		if(trajPointStorage._layers[l].feature.properties[keys[k]] === val) {
			trajPointStorage.removeLayer(trajPointStorage._layers[l]);
		}
	}
	
	Object.keys(trajPointStorage._layers).forEach(function() {
		for(var k = 0; k < keys.length; k++) {
			obj[keys[k]].forEach(trajPointRemove);
		}
	});
	
	if(trajLayer._layers.length === 0) {
		map.fitBounds(bounds);
	} else {
		map.fitBounds(trajLayer.getBounds());
	}
	
}

// SITE SUPPORT FUNCTIONS //

function addSite(siteId) {
	'use strict';
	var site = sites[siteId];

	selectedSites[siteId] = sites[siteId];
	var marker = L.marker([site.LAT, site.LNG], {icon: monIcon}).toGeoJSON();
	marker.properties = site;
	siteLayer.addData(marker);
	
	addTrajectory({SITE_ID: siteId});
	
}

function removeSite(siteId) {
	'use strict';
	delete selectedSites[siteId];
	Object.keys(siteLayer._layers).forEach(function(l) {
		if(siteLayer._layers[l].feature.properties.SITE_ID === siteId) {
			siteLayer.removeLayer(siteLayer._layers[l]);
		}
	});

	removeTrajectory({SITE_ID: [siteId]});
	
}

// Load the states data

$.ajax({
	dataType: 'json',
	url: 'data/states.geojson',
	success: function(data) {
		'use strict';
		statesLayer.addData(data);
	}
});

// Load the sites data
$.ajax({
	dataType: 'json',
	url: 'data/sites.json',
	success: function(data) {
		'use strict';
		sites = data;
		var $mon = $('#monitors');
		Object.keys(sites).map(function(el) {
			var inc = ['09-009-0027', '24-033-8003', '34-007-1001', '34-015-0002',
							'09-003-1003', '24-015-0003', '09-001-1123', '09-011-0124', 
							'09-013-1001', '09-007-0007', '09-001-0017', '09-001-3007', 
							'09-001-9003'];
			if(inc.indexOf(el) > -1) {
				$mon.append('<option value = "' + el + '">' + el + '</option>');
			}
		});
		$mon.select2({width: '100%', placeholder: 'Select Monitors'});
		$mon.on('change', function(ev) {
			if(ev.hasOwnProperty('added')) {
				addSite(ev.added.id);
			}
			
			if(ev.hasOwnProperty('removed')) {
				removeSite(ev.removed.id);
			}			
		
		});
	}
});

function resizeMap() {
	'use strict';
  document.getElementById('map').style.width = $('#map').parent().width() + 'px';
  var h = Math.min(window.innerHeight, $('#map').parent().width()) * 0.85;
  document.getElementById('map').style.height = h + 'px'; 
  map.fitBounds(bounds);
}

// MAP OBJECT //
map = L.map('map', {});

// CHART OBJECT //

chart = c3.generate({
	bindto: '#heightPlot',
	data: {x: 'hour', 
			  columns: [[null]],
			  selection: {enabled: true},
			  onmouseover: function(d) {
					'use strict';
					trajPointLayer.clearLayers();
					trajPointStorage.eachLayer(function(layer) {
						if(layer.feature.properties.SITE_ID === activeReading.site &&
							layer.feature.properties.year === activeReading.year &&
							layer.feature.properties.rank === activeReading.rank &&
							layer.feature.properties.age === -d.x) {
						
							trajPointLayer.addData(layer.toGeoJSON());
						
						}
					
					});
			  }},
	axis: {
		y: {label: {text: 'Height (m)', position: 'outer-middle'}},
		x: {label: {text: 'Hour', position: 'outer-center'}, min: 0, max: 72}
	},
	color: {pattern: ['#0000FF', '#FF0000', '#00FF00']},
	padding: {right: 30, top: 30},
	onmouseout: function() {
		'use strict';
		trajPointLayer.clearLayers();
	}
});

// LAYERS //

basemap = L.layerGroup([L.esri.basemapLayer('Gray')]);
basemap.addTo(map);

statesLayer = L.geoJson(null, {
	filter: function(feature) {
		'use strict';
		return feature.properties.STATEFP === '18';
	},
	style: {color: '#66A', weight: '2', fillColor: '#BBF'}
}).addTo(map);

siteLayer = L.geoJson(null, {
	pointToLayer: function(feature, latlng) {
		'use strict';
		return L.marker(latlng, {icon: monIcon});
	},
	onEachFeature: function(feature, layer) {
		'use strict';
		layer.on({
			mouseover: function(e) {
				trajHighlight(e, 'SITE_ID');
			},
			mouseout: function() {
				trajUnHighlight();
			}			
		});
	}
}).addTo(map);

trajLayer = L.geoJson(null, {
	filter: function(feature) {
		'use strict';
		return feature.geometry.type === 'LineString';
	},
	onEachFeature: function(feature, layer) {
		'use strict';
		layer.on({
			mouseover: function(e) {
				if(trajLock === false) {
					trajHighlight(e, ['rank', 'date', 'SITE_ID']);
				}
			},
			mouseout: function() {
				if(trajLock === false) {
					trajUnHighlight();
				}
			},
			click: function(e) {
				trajLock = true;
				trajHighlight(e, ['rank', 'date', 'SITE_ID']);
			}
		});		
	},
	style: function(feature) {
		'use strict';
		var style = {weight: 3, opacity: 0.7};
		if(feature.properties.height === 10) {
			style.color = '#00FF00';
		} else if(feature.properties.height === 100) {
			style.color = '#FF0000';
		} else {
			style.color = '#0000FF';
		}
		return style;
	}
}).addTo(map);

trajPointStorage = L.geoJson(null, {
	pointToLayer: function(feature, latlng) {
		'use strict';
		return L.marker(latlng, {icon: trajStorageIcon});
	},
	filter: function(feature) {
		'use strict';
		return feature.geometry.type === 'Point';
	},
	onEachFeature: function(feature, layer) {
		'use strict';
		layer.on({
			mouseover: function(e) {
				if(trajLock === false) {
					trajHighlight(e, ['rank', 'date', 'SITE_ID']);
				}
			},
			mouseout: function() {
				if(trajLock === false) {
					trajUnHighlight();
				}
			},
			click: function(e) {
				trajLock = true;
				trajHighlight(e, ['rank', 'date', 'SITE_ID']);
			}			
		});
	}
}).addTo(map);

trajPointLayer = L.geoJson(null, {
	pointToLayer: function(feature, latlng) {
		'use strict';
		return L.circleMarker(latlng, {radius: 6});
		//return L.marker(latlng, {icon: trajIcon})
	},
	style: function(feature) {
		'use strict';
		var style = {weight: 2, opacity: 1, fillOpacity: 0.8};
		if(feature.properties.releaseHeight === 10) {
			style.color = 'black';
			style.fillColor = '#00FF00';
		} else if(feature.properties.releaseHeight === 100) {
			style.color = 'black';
			style.fillColor = '#FF0000';
		} else {
			style.color = 'black';
			style.fillColor = '#0000FF';
		}
		return style;
	
	}
}).addTo(map);

// SET EVENT LISTENERS //

$(window).resize(function() {
	'use strict';
  resizeMap();
});

$('#map').on('click', function() {
	'use strict';
	trajLock = false;
	activeReading ={};
	trajUnHighlight();
});

$('input[name="rank[]"]').on('change', function(ev) {
	'use strict';
	if(ev.target.checked) {
		addTrajectory({rank: ev.target.value});
	} else {
		removeTrajectory({rank: [ev.target.value]});
	}
});

$('input[name="year[]"]').on('change', function(ev) {
	'use strict';
	if(ev.target.checked) {
		addTrajectory({year: ev.target.value});
	} else {
		removeTrajectory({year: [ev.target.value]});
	}
});

// Make sure the map is the right size to start
resizeMap();