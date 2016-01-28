
$(document).ready(function() {

var map_grid = {
  width: 20,
  height: 10
};

var locations = {
  black_forest: {
    height_map: {
      noise: 'perlin2',
      size: 1/4,
    },
    ground: { r: 87, g: 109, b: 20 },
    water: {
      size: 1/4,
      water_level: 0.65,
    },
    trees: {
      size: 1/4,
      freq: .80,
      noise: 'perlin2',
    },
  }
};

var options = {
  location: locations.black_forest,
  map_grid: map_grid,

      board_title: {
        height: 24,
      },

      board_tool_bar: {
        height: 32,
      },

      player_colour: { 0: "Blue", 1: "White" },
      num_sections: 1,
      num_cities_total: 9,

      max_farm_distance: 2,
      farm_probability_factor: 0.8,
};

var mapCreator = new MapCreator();
var terrain_map = mapCreator.buildNewMap(options).terrain_type;
console.log(terrain_map);

var terrain_map = terrain_map[0].map(function(col, i) { 
  return terrain_map.map(function(row) { 
    return row[i] 
  });
});

function make_hex(class_name, content) {
  var hex_div = jQuery('<div/>', {
    class: class_name,
  });
  var contents = "<span>{0}</span><div></div><div></div>".format(content);

  hex_div.append(contents);
  return hex_div;
}

function add_hex_row() {
  var hex_row_div = jQuery('<div/>', {
    class: 'hexrow',
  });
  $('.hexes').append(hex_row_div);
  return hex_row_div;
}

for (var i=0; i<terrain_map.length; i++) {
  var row = add_hex_row();
  for (var j=0; j < terrain_map[i].length; j++) {
    var hex = make_hex('test_class', '{0}, {1}'.format(i, j));
    row.append(hex);
  }
}

});
