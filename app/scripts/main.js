/* jshint devel:true */

var bounds = L.latLngBounds([30.5, -89], [47, -70]), 
	  mon_icon = L.divIcon({iconSize: 10, className: "mon-icon"}),
	  traj_icon = L.divIcon({iconSize: 5, className: "traj-icon"}),
	  traj_storage = L.divIcon({iconSize: 10, className: "traj-storage"}),
	  states_layer, sites, map, chart, basemap, site_layer,
	  traj_layer, traj_point_layer, selectedSites = {},
	  traj_lock = false, active_reading = {};

// MAP STUFF //

// Load the states data

$.ajax({
	dataType: "json",
	url: "data/states.geojson",
	success: function(data) {
		states_layer.addData(data)
	}
});

// Load the sites data
$.ajax({
	dataType: "json",
	url: "data/sites.json",
	success: function(data) {
		sites = data
		var $mon = $("#monitors");
		var siteSelect = Object.keys(sites).map(function(el) {
			var inc = ['09-009-0027', '24-033-8003', '34-007-1001', '34-015-0002',
							'09-003-1003', '24-015-0003', '09-001-1123', '09-011-0124', 
							'09-013-1001', '09-007-0007', '09-001-0017', '09-001-3007', 
							'09-001-9003']
			if(inc.indexOf(el) > -1) {
				$mon.append("<option value = '" + el + "'>"+el+"</option>")
			}
		})
		$mon.select2({width: "100%", placeholder: "Select Monitors"})
		$mon.on("change", function(ev) {
			if(ev.hasOwnProperty("added")) {
				addSite(ev.added.id);
			}
			
			if(ev.hasOwnProperty("removed")) {
				removeSite(ev.removed.id);
			}			
		
		})
	}
});

function resizeMap() {
  document.getElementById("map").style.width = $("#map").parent().width() + "px";
  var h = Math.min(window.innerHeight, $("#map").parent().width()) * 0.85;
  document.getElementById("map").style.height = h + "px"; 
  map.fitBounds(bounds);
}

// MAP OBJECT //
map = L.map("map", {});

// CHART OBJECT //

chart = c3.generate({
	bindto: "#heightPlot",
	data: {x: 'hour', 
			  columns: [[null]],
			  selection: {enabled: true},
			  onmouseover: function(d) {
					traj_point_layer.clearLayers();
					traj_point_storage.eachLayer(function(layer) {
						if(layer.feature.properties.SITE_ID == active_reading.site &&
							layer.feature.properties.year == active_reading.year &&
							layer.feature.properties.rank == active_reading.rank &&
							layer.feature.properties.age == -d.x) {
						
							traj_point_layer.addData(layer.toGeoJSON());
						
						}
					
					})
			  }},
	axis: {
		y: {label: {text: "Height (m)", position: "outer-middle"}},
		x: {label: {text: "Hour", position: "outer-center"}, min: 0, max: 72}
	},
	color: {pattern: ['#0000FF', '#FF0000', "#00FF00"]},
	padding: {right: 30, top: 30},
	onmouseout: function() {
		traj_point_layer.clearLayers();
	}
})

// LAYERS //

basemap = L.layerGroup([L.esri.basemapLayer("Gray")]);
basemap.addTo(map);

states_layer = L.geoJson(null, {
	filter: function(feature) {
		return feature.properties.STATEFP == "18";
	},
	style: {color: "#66A", weight: "2", fillColor: "#BBF"}
}).addTo(map);

site_layer = L.geoJson(null, {
	pointToLayer: function(feature, latlng) {
		return L.marker(latlng, {icon: mon_icon});
	},
	onEachFeature: function(feature, layer) {
		layer.on({
			mouseover: function(e) {
				trajHighlight(e, "SITE_ID")
			},
			mouseout: function(e) {
				trajUnHighlight()
			}			
		})
	}
}).addTo(map);

traj_layer = L.geoJson(null, {
	filter: function(feature) {
		return feature.geometry.type == "LineString";
	},
	onEachFeature: function(feature, layer) {
		layer.on({
			mouseover: function(e) {
				if(traj_lock == false) trajHighlight(e, ["rank", "date", "SITE_ID"])
			},
			mouseout: function(e) {
				if(traj_lock == false) trajUnHighlight()
			},
			click: function(e) {
				traj_lock = true;
				trajHighlight(e, ["rank", "date", "SITE_ID"])
			}
		})		
	},
	style: function(feature, layer) {
		var style = {weight: 3, opacity: 0.7}
		if(feature.properties.height == 10) {
			style.color = "#00FF00";
		} else if(feature.properties.height == 100) {
			style.color = "#FF0000";
		} else {
			style.color = "#0000FF";
		}
		return style;
	}
}).addTo(map);

traj_point_storage = L.geoJson(null, {
	pointToLayer: function(feature, latlng) {
		return L.marker(latlng, {icon: traj_storage});
	},
	filter: function(feature) {
		return feature.geometry.type == "Point";
	},
	onEachFeature: function(feature, layer) {
		layer.on({
			mouseover: function(e) {
				if(traj_lock == false) trajHighlight(e, ["rank", "date", "SITE_ID"])
			},
			mouseout: function(e) {
				if(traj_lock == false) trajUnHighlight()
			},
			click: function(e) {
				traj_lock = true;
				trajHighlight(e, ["rank", "date", "SITE_ID"])
			}			
		})
	}
}).addTo(map);

traj_point_layer = L.geoJson(null, {
	pointToLayer: function(feature, latlng) {
		return L.circleMarker(latlng, {radius: 6})
		//return L.marker(latlng, {icon: traj_icon})
	},
	style: function(feature, layer) {
		var style = {weight: 2, opacity: 1, fillOpacity: 0.8}
		if(feature.properties.releaseHeight == 10) {
			style.color = "black";
			style.fillColor = "#00FF00";
		} else if(feature.properties.releaseHeight == 100) {
			style.color = "black";
			style.fillColor = "#FF0000";
		} else {
			style.color = "black";
			style.fillColor = "#0000FF";
		}
		return style;
	
	}
}).addTo(map);

// Trajectory Support Functions //

function addTrajectory(obj) {
	
	addTraj = function(site, year, rank) {
	
		var url = "data/trajectories/" + site + "_" + year + "_" + rank + ".geojson";
	
		$.ajax({
			dataType: "json",
			url: url,
			success: function(data) {
				traj_layer.addData(data);	
				traj_point_storage.addData(data);
			}
		})
	
	}
		
	if(obj.hasOwnProperty("year")) {
		var sites = $("#monitors").select2("val");
		var ranks = $("input[name='rank[]']:checked").map(function(i) {return $(this).val()}).get();
		var years = [obj.year];
	}
	
	if(obj.hasOwnProperty("rank")) {
		var sites = $("#monitors").select2("val");
		var ranks = [obj.rank]
		var years = $("input[name='year[]']:checked").map(function(i) {return $(this).val()}).get();
	}
	
	if(obj.hasOwnProperty("SITE_ID")) {
		var sites = [obj.SITE_ID];
		var ranks = $("input[name='rank[]']:checked").map(function(i) {return $(this).val()}).get();
		var years = $("input[name='year[]']:checked").map(function(i) {return $(this).val()}).get();
	}
	
	for(var year = 0; year < years.length; year++) {
		for(var rank = 0; rank < ranks.length; rank++) {
			for(var site = 0; site < sites.length; site++) {
			
				addTraj(sites[site], years[year], ranks[rank]);
			
			}
		}
	}
	
	map.fitBounds(traj_layer.getBounds());
	
}

function removeTrajectory(obj) {

	var keys = Object.keys(obj);

	Object.keys(traj_layer._layers).forEach(function(l) {
	
		for(var k = 0; k < keys.length; k++) {
		
			obj[keys[k]].forEach(function(val) {
				if(traj_layer._layers[l].feature.properties[keys[k]] == val) {
					traj_layer.removeLayer(traj_layer._layers[l]);
				}
			})
		
		}

	});
	
	Object.keys(traj_point_storage._layers).forEach(function(l) {
		
		for(var k = 0; k < keys.length; k++) {
			obj[keys[k]].forEach(function(val) {
				if(traj_point_storage._layers[l].feature.properties[keys[k]] == val) {
					traj_point_storage.removeLayer(traj_point_storage._layers[l]);
				}
			})
		}
	});
	
	if(traj_layer._layers.length == 0) {
		map.fitBounds(bounds);
	} else {
		map.fitBounds(traj_layer.getBounds());
	}
	
};

function trajHighlight(e, sel) {

	var props = e.target.feature.properties;
	if(!$.isArray(sel)) sel = [sel];
	traj_point_layer.clearLayers();
	var plotLayers = [];
		
	traj_layer.eachLayer(function(layer) {
		
		var inc = true;
		
		for(p in sel) {
			if(layer.feature.properties[sel[p]] !== props[sel[p]]) inc = false;
		}
		
		if(inc == true) {
			layer.setStyle({weight: 4, opacity: 1});
			plotLayers.push(layer)
		} else {
			layer.setStyle({weight: 1, opacity: 0.2});
		}
		
	})
	
	$("#site_id").html(props.SITE_ID);
	$("#date").html(props.date);
	$("#rank").html(props.rank);
	$("#conc").html(props.conc + " ppb");
	$("#conc_hour").html(props.conc_hour);
	
	showHeightPlot(plotLayers);

}

function trajUnHighlight() {

	traj_layer.eachLayer(function(layer) {
		layer.setStyle({weight: 3, opacity: 0.7})
	});
	traj_point_layer.clearLayers();
	chart.unload({ids: ["1000", "100", "10"]});

}

// SITE SUPPORT FUNCTIONS //

function addSite(site_id) {

	var site = sites[site_id];

	selectedSites[site_id] = sites[site_id];
	var marker = L.marker([site.LAT, site.LNG], {icon: mon_icon}).toGeoJSON();
	marker.properties = site;
	site_layer.addData(marker);
	
	addTrajectory({SITE_ID: site_id});
	
};

function removeSite(site_id) {

	delete selectedSites[site_id]
	Object.keys(site_layer._layers).forEach(function(l) {
		if(site_layer._layers[l].feature.properties.SITE_ID == site_id) {
			site_layer.removeLayer(site_layer._layers[l]);
		}
	});

	removeTrajectory({SITE_ID: [site_id]});
	
}

// CHART SUPPORT FUNCTIONS //

showHeightPlot = function(layers) {

	var labels = [], values = [], hour = ["hour"];
			
	for(var i = 0; i <= 72; i++) hour.push(i);
			
	active_reading.site = layers[0].feature.properties.SITE_ID;
	active_reading.year = layers[0].feature.properties.year;
	active_reading.rank = layers[0].feature.properties.rank;
	active_reading.date = layers[0].feature.properties.date;
			
	layers.forEach(function(layer) {
	
		var lbl = String(layer.feature.properties.height);
		if(labels.indexOf(lbl) == -1) {
			labels.push(lbl);
			values.push([lbl]);
		}
		var i = labels.indexOf(lbl);
		layer.feature.geometry.coordinates.forEach(function(el) {values[i].push(el[2])});
	
	})
				
	values.push(hour);
			
	chart.load({columns: values, unload: true});

}

// SET EVENT LISTENERS //

$(window).resize(function() {
  resizeMap();
})

$("#map").on("click", function(ev) {
	traj_lock = false;
	active_reading ={};
	trajUnHighlight()
});

$("input[name='rank[]']").on("change", function(ev) {
	if(ev.target.checked) {
		addTrajectory({rank: ev.target.value})
	} else {
		removeTrajectory({rank: [ev.target.value]})
	}
});

$("input[name='year[]']").on("change", function(ev) {
	if(ev.target.checked) {
		addTrajectory({year: ev.target.value})
	} else {
		removeTrajectory({year: [ev.target.value]})
	}
});

// Make sure the map is the right size to start
resizeMap();