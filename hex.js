
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

  /*
      map_sizes: {
        miniature: {
          width: 10,
          height: 6,
          tile: tile,
        },
        tiny: {
          width: 15,
          height: 8,
          tile: tile,
        },
        small: {
          width: 25,
          height: 15,
          tile: tile,
        },
        medium: {
          width: 33,
          height: 19,
          tile: tile,
        },
        large: {
          //width: Math.ceil(map_width),
          //height: Math.ceil(map_width),
          //height: Math.ceil(map_width * 3 / 4),
          //height: Math.ceil(map_width * 0.5625),
          width: 40,
          height: 23,
          tile: tile,
        },
      },
  */

      board_title: {
        height: 24,
      },

      board_tool_bar: {
        height: 32,
      },

      player_colour: { 0: "Blue", 1: "White" },
      num_sections: 3,
      num_cities_total: 9,

      max_farm_distance: 2,
      farm_probability_factor: 0.8,
};

var mapCreator = new MapCreator();
//console.log(mapCreator);
console.log(mapCreator.buildNewMap(options));

