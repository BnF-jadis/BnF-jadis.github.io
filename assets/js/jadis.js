$(window).resize(function() {
  sizeLayerControl();
});

// Global variables declaration
var layerControl, geocoderControl, loaded_maps, map;
var groupedOverlays, baseLayers, thinnedLayer;

var blankUrl = 'https://bnf-jadis.github.io/assets/img/blank.png';
var selectedMap = 'btv1b53029027w';
var selectedYear = 0;
var transparent = false;
var firstTransparencyActivation = true, firstVectorizedActivation = true;

var ghd={
	wms:{
		url:'http://geohistoricaldata.org/geoserver/wms',
		opts_default:{
			style:'raster',
			attribution: "Map data &copy; <a href='http://geohistoricaldata.org/'>http://geohistoricaldata.org/</a>'",
			transparent:true,
			format:'image/png',
			maxZoom:21,
			tileSize:512
		}
	}
};

var CartoDB_DarkMatterNoLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 19
});

// Navigation
$("#about-btn").click(function() {
  $("#aboutModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});


$("#legend-btn").click(function() {
  $("#legendModal").modal("show");
  $(".navbar-collapse.in").collapse("hide");
  return false;
});


$("#nav-btn").click(function() {
  $(".navbar-collapse").collapse("toggle");
  return false;
});


function sizeLayerControl() {
  $(".leaflet-control-layers").css("max-height", $("#map").height() - 50);
}

// Larger screens get expanded layer control and visible sidebar
if (document.body.clientWidth <= 1080) {
  var isCollapsed = true;
} else {
  var isCollapsed = false;
}


// Load Map Functions

function layerImage(imageUrl, imageBounds){
    return new L.imageOverlay(imageUrl, imageBounds);
}

function layerImageRotated(imageUrl, topleft, topright, bottomleft){
    return new L.imageOverlay.rotated(imageUrl, topleft, topright, bottomleft);
}

function layerPolyline(imageUrl){

	var request_ = initRequest(imageUrl);

	request_.onload = function() {
	    var jsonTable = request_.response;
	    return new L.polyline(jsonTable, {color: 'red', weight: 1.0, opacity: 0.5});
	}
}


function initRequest(requestURL){

	var request = new XMLHttpRequest();
	request.open('GET', requestURL);
	request.responseType = 'json';
	request.send();

	return request;
}


function init(){

	// Initialize map and year select buttons
	(function() {
	  document.getElementById("selectMap").style.marginTop = 15 + "px";
	  document.getElementById("selectYear").style.marginTop = 15 + "px";

	  var request = initRequest('https://bnf-jadis.github.io/assets/data/df_website.json');
	  request.onload = function() {
	  
	    var jsonObject = request.response;

	    for (var year = 1950; year >= 1770; year--) {

			var subset = $.grep(jsonObject, function( n, i ) {
			  return n.date == year;
			});

			if (subset.length > 0) {
				var optionElement = document.createElement("option");
			    optionElement.setAttribute("value", year.toString());

			    if (year == 1894){
			    	optionElement.setAttribute("selected", true);
			    }

			    var textNode = document.createTextNode(year.toString());
			    optionElement.appendChild(textNode);
			    document.getElementById("selectYear").appendChild(optionElement);
			}
	    }
	    selectYearUpdate()
	  }
	})();

	// Initialize map
	map = L.map('map', {
	    center: [48.855426, 2.345846],
	    zoom: 14,
	    layers: [CartoDB_DarkMatterNoLabels],
	    fullscreenControl: true,
	    fullscreenControlOptions: {
	        title:"Plein écran"
	    },
	    attributionControl: false
	});

	map.options.maxZoom = 21;

	var attributionControl = L.control({
	  position: "bottomright"
	});
	attributionControl.onAdd = function (map) {
	  var div = L.DomUtil.create("div", "leaflet-control-attribution");
	  div.innerHTML = "<a href='#' onclick='$(\"#attributionModal\").modal(\"show\"); return false;'>Attribution</a>";
	  return div;
	};
	map.addControl(attributionControl);

	// Update map and controls
	var options = { collapsed: isCollapsed };

	// Add scale bar
	L.control.scale().addTo(map);

	var leaflet = 1;
	var ark = selectedMap;
	var geolocalisation = [[48.910531626013096, 2.2427913673456756],[48.80798996500141, 2.2428784991569115], 
						   [48.80805862730653, 2.429786776654294], [48.910600288318214, 2.4296996483981594]];

	updateMap(ark, geolocalisation, leaflet, 0.55, true);

	map.addLayer(loaded_maps.base_map_low)

}

init()


// Location
map.locate({setView: true, maxZoom: 15});

function onLocationFound(e) {
    var radius = e.accuracy / 2;
    L.marker(e.latlng).addTo(map).bindPopup("Vous êtes dans un rayon de " + radius + " mètres de ce point").openPopup();
    L.circle(e.latlng, radius).addTo(map);
}

map.on('locationfound', onLocationFound);
function onLocationError(e) { }

map.on('locationerror', onLocationError);


// Function checkbox
function LayerState(CheckboxName, layer){
    var objCheckbox = document.getElementById(CheckboxName);
    if (objCheckbox.checked) {map.addLayer(layer);}
    else {map.removeLayer(layer);}
}

// Leaflet patch to make layer control scrollable on touch browsers
var container = $(".leaflet-control-layers")[0];
if (!L.Browser.touch) {
  L.DomEvent
  .disableClickPropagation(container)
  .disableScrollPropagation(container);
} else {
  L.DomEvent.disableClickPropagation(container);
}

function updateMap(ark, geolocalisation, leaflet, score, init) {

	var qualitative_score;

	if (score < 0.5){
		qualitative_score = 'très élevée';
	}
	else if (score < 0.6){
		qualitative_score = 'élevée';
	}
	else{
		qualitative_score = 'acceptable';
	}

	document.getElementById("scores-print").innerHTML = qualitative_score;

	if (ark != '') {
		if (!init){
			geocoderControl.remove(map)
			for (i in layerControl._layers) {
				var layer = layerControl._layers[i].layer;
				layerControl.removeLayer(layer);
				if (map.hasLayer(layer)) {
				    map.removeLayer(layer);
				}
			}
		}
		
		var imageUrl = {
			"high": 'https://gallica.bnf.fr/iiif/ark:/12148/' + ark + '/f' + leaflet + '/full/full/0/native.jpg',
			"medium": 'https://gallica.bnf.fr/iiif/ark:/12148/' + ark + '/f' + leaflet + '/full/4400,3600/0/native.jpg',
			"low": 'https://gallica.bnf.fr/iiif/ark:/12148/' + ark + '/f' + leaflet + '/full/3300,2400/0/native.jpg',
		};

		var vectorizedMapUrl = 'https://bnf-jadis.github.io/export/maps/12148_' + ark + 'f' + leaflet + '.png';
		var deformationMapUrl = 'https://bnf-jadis.github.io/export/deformation/12148_' + ark + 'f' + leaflet + '.png';
		var thinnedMapUrl = 'https://bnf-jadis.github.io/export/vectorized/12148_' + ark + 'f' + leaflet + '.json';

		var topleft    = L.latLng(geolocalisation[0][0], geolocalisation[0][1]), 
			topright   = L.latLng(geolocalisation[3][0], geolocalisation[3][1]), 
			bottomleft = L.latLng(geolocalisation[1][0], geolocalisation[1][1]);
		
		// Maps levels
		loaded_maps = {

			vectorized_map:layerImageRotated(vectorizedMapUrl, topleft, topright, bottomleft),
			transparency:layerImageRotated(blankUrl, topleft, topright, bottomleft),
			deformation:layerImageRotated(deformationMapUrl, topleft, topright, bottomleft),
			road_network:layerImageRotated(blankUrl, topleft, topright, bottomleft),
			
			base_map_high:layerImageRotated(imageUrl['high'], topleft, topright, bottomleft),
			base_map_medium:layerImageRotated(imageUrl['medium'], topleft, topright, bottomleft),
			base_map_low:layerImageRotated(imageUrl['low'], topleft, topright, bottomleft)
		};

		var options = { collapsed: isCollapsed };
		
		map.setView([48.855426, 2.345846], 13);

	    baseLayers = {
			"Basse résolution": loaded_maps.base_map_low,
			"Moyenne résolution": loaded_maps.base_map_medium,
			"Haute résolution": loaded_maps.base_map_high
	  	};
	    
	    groupedOverlays = {
			"Couches" : {
				"Transparence": loaded_maps.transparency,
				"Îlots": loaded_maps.vectorized_map,
				"Réseau viaire": loaded_maps.road_network,
				"Déformation de la carte": loaded_maps.deformation
			}
	    };

	    groupedOverlays["Couches"]["Transparence"].setOpacity(0.);

	    if (!init){
	    	layerControl.remove(map);
	    }
	    
		layerControl = L.control.groupedLayers(baseLayers, groupedOverlays, options).addTo(map);
		
		var request_ = initRequest(thinnedMapUrl);

		request_.onload = function() {
		    var jsonTable = request_.response;
		    var thinned = new L.polyline(jsonTable, {color: '#00225C', weight: 1.5, opacity: 0.7});
		    groupedOverlays["Couches"]["Réseau viaire"] = thinned;
		    var options = { collapsed: isCollapsed };

		    for (layer in layerControl._layers) {
		    	if (layerControl._layers[layer].name == "Réseau viaire"){
		    		layerControl._layers[layer].layer = thinned;
		    	}
		    }

		    var geocoder = new L.Control.Geocoder.Nominatim();
			geocoderControl = L.Control.geocoder({geocoder: geocoder}).addTo(map);
		}

		updateOpacity();

		map.addLayer(baseLayers["Basse résolution"])

		var loader = L.control.loader().addTo(map);

		var loaded = {
			"low": false,
			"medium": false,
			"high": false
		}

		loaded_maps.base_map_low.on('load', function () {
			loader.hide()
	    	loader.remove(map);
	    	loaded["low"] = true;
		});

		loaded_maps.base_map_medium.on('add', function () {
	    	if (loaded["medium"] != true) {
				loader = L.control.loader().addTo(map);
			}
		});

		loaded_maps.base_map_medium.on('load', function () {
			loader.hide()
	    	loader.remove(map);
	    	loaded["medium"] = true;
		});

		loaded_maps.base_map_high.on('add', function () {
			if (loaded["high"] != true) {
				loader = L.control.loader().addTo(map);
			}
	    });

		loaded_maps.base_map_high.on('load', function () {
			loader.hide()
	    	loader.remove(map);
	    	loaded["high"] = true;
		});

		loaded_maps.vectorized_map.on('add', function () {
		if (firstVectorizedActivation) {
    		firstVectorizedActivation = false;
    		 window.alert("INFORMATION: Vectorisation expérimentale \n\n\
Vous vous apprêtez à activer la vectorisation. Ce résultat accessoire de la recherche comporte des erreurs \n\
et est présenté ici à titre d'expérmentation. \n \n");
    	}
		});

		loaded_maps.transparency.on('add', function () {
		transparent = true;
		updateOpacity();
    	if (firstTransparencyActivation) {
    		firstTransparencyActivation = false;
    		window.alert("INFORMATION: Transparence \n\n\
Vous avez activé la transparence. N'oubliez pas que les cartes anciennes peuvent être déformées et donc ne pas \n\
se superposer parfaitement à la carte actuelle. Pour visualiser la déformation estimée de la carte, activez la \n\
couche intitulée \"Déformation de la carte\". \n \n");
	    }
		});

		loaded_maps.deformation.on('add', function () {
			if (firstVectorizedActivation) {
	    		firstVectorizedActivation = false;
	    		 window.alert("INFORMATION: Déformation \n\n\
	les cartes anciennes peuvent être déformées en raison d'imprécisions lors des relevés, du dessin, de \n\
	l'impression, ou à cause de la déformation du matériau avec le temps. Dans cette visualisation, les \n\
	zones sombres correspondent à une faible déformation et les zones les plus colorées à une forte déformation\n \n");
	    	}
		});

		loaded_maps.transparency.on('remove', function () {
			transparent = false;
			updateOpacity();
		});
	}
}


function selectYearUpdate() {

	selectedYear = document.getElementById("selectYear")[document.getElementById("selectYear").selectedIndex]['label'];

	var request = initRequest('https://bnf-jadis.github.io/assets/data/df_website.json');
	request.onload = function() {
	  var jsonObject = request.response;

	  var subset = $.grep(jsonObject, function( n, i ) {
		  return n.date == selectedYear;
		});


	  while (document.getElementById("selectMap").firstChild) {
		document.getElementById("selectMap").removeChild(document.getElementById("selectMap").firstChild);
	  }

	  (function() {

	  	  var optionElement = document.createElement("option");
	  	  optionElement.setAttribute("value", '');

	  	  if (subset.length > 0) {
	  	  	var textNode = document.createTextNode(' (Sélectionner)');
	  	  }
	  	  else {
	  	  	var textNode = document.createTextNode(' (Aucune carte cette année)')
	  	  }

	  	  optionElement.appendChild(textNode);
		  document.getElementById("selectMap").appendChild(optionElement);

		  for (var i = 0; i < subset.length; i++) {
		  	var optionElement = document.createElement("option");
		    optionElement.setAttribute("value", subset[i]['ark']);

		    var text = subset[i]['title'];
		    if (text.length > 80){
		    	text = text.slice(0, 80) + ' ...';
		    }

		    var textNode = document.createTextNode(text);
		    
		    optionElement.appendChild(textNode);
		    document.getElementById("selectMap").appendChild(optionElement);
		  }
		})();
	}
}


function selectMapUpdate() {

	var request = initRequest('https://bnf-jadis.github.io/assets/data/df_website.json');
	request.onload = function() {
	  
	  var indice = document.getElementById("selectMap").selectedIndex;

	  if (indice != 0){

	  	var jsonObject = request.response;

	  	var subset = $.grep(jsonObject, function( n, i ) {
		  return n.date == selectedYear;
		});

	  	selectedMap = subset[indice - 1]['ark'].substring(6, 100);
	  	
	  	var geolocalisation = subset[indice - 1]['geolocalisation'];
	  	var leaflet = subset[indice - 1]['leaflet'];
	  	var score = subset[indice - 1]['geoloc_score'];

		var ark = selectedMap;

		updateMap(ark, geolocalisation, leaflet, score, false);
		document.getElementById("see-on").href = "https://gallica.bnf.fr/ark:/12148/" + ark;
	}
	}
}

function updateOpacity() {
	if (transparent) {
		baseLayers["Basse résolution"].setOpacity(0.3);
		baseLayers["Moyenne résolution"].setOpacity(0.3);
		baseLayers["Haute résolution"].setOpacity(0.3);
		groupedOverlays["Couches"]["Îlots"].setOpacity(0.15);
		groupedOverlays["Couches"]["Déformation de la carte"].setOpacity(0.5);

	}
	else {
		baseLayers["Basse résolution"].setOpacity(1);
		baseLayers["Moyenne résolution"].setOpacity(1);
		baseLayers["Haute résolution"].setOpacity(1);
		groupedOverlays["Couches"]["Îlots"].setOpacity(0.5);
		groupedOverlays["Couches"]["Déformation de la carte"].setOpacity(0.7);
	}
}

