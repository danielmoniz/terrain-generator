if (typeof require !== 'undefined') {
  Utility = require("./utility");
  Pathing = require("./pathing");
  TerrainData = require("./components/terrain_data");
  UnitData = require("./components/unit_data");

  astar = require("../lib/astar.js");
  Pathfind = astar.astar;
  Noise = require("../lib/perlin").noise;
  Graph = astar.Graph;
} else {
  Noise = noise;
  Pathfind = astar;
}

var MapCreator = function(options) {

  this.Game = {};

  this.Game.player_supply_roads = [[], []];
  this.Game.supply_route = [];

  this.height_map = [];
  this.occupied = [];
  this.terrain_type = [];
  this.map_grid = {};
  this.options = options;

  this.buildNewMap = function(options) {
    this.Game.section_widths = this.getWidthOfSections(options);
    this.adjustMapSizeForNumberOfSections(options, this.Game.section_widths);
    this.Game.section_positions = this.getPositionOfSections(this.Game);

    this.Game.height_map = this.generateHeightMap(options, options.location);
    this.buildEmptyGameData(options, this.Game);
    this.addWater(options, this.Game, options.location);

    var cities = this.addCities(options, this.Game, options.num_cities_total);
    var town_locations = this.addTownsAroundCities(options, this.Game, cities);
    this.addFarms(options, this.Game, cities);
    this.addTrees(options, this.Game, options.location);
    this.addGrass(options, this.Game);

    //this.updateBuildDifficultyData(options, this.Game.terrain_type);

    this.buildTerrainData(options, this.Game, this.Game.terrain_type);
    this.addSupplyRoads(options, this.Game, cities, 1);
    this.addRoadsBetweenCities(options, this.Game, cities);
    this.cleanRoads(options, this.Game.roads);
    this.buildTerrainDataWithRoads(options, this.Game, this.Game.terrain_type, this.Game.roads);

    // call again to ensure bridge values are set
    this.buildTerrainData(options, this.Game, this.Game.terrain_type);

    this.Game.starting_units = this.addStartingUnits(options, this.Game);
    /*

    if (Game.fog_of_war) {
      shadowHeightMap(Game.location);
      LineOfSight.clearFog();
    }
    */

   var map_data = {};
   map_data.terrain_type = this.Game.terrain_type;
   map_data.height_map = this.Game.height_map;
   map_data.player_supply_roads = this.Game.player_supply_roads;
   map_data.supply_route = this.Game.supply_route;

   return this.Game;
  };

  this.getWidthOfSections = function(options) {
    var map_width = options.map_grid.width;
    var section_widths = [];

    var width_remaining = map_width;
    var num_sections_left = options.num_sections;
    var left_sections = [];
    var right_sections_reversed = [];

    while (num_sections_left >= 2) {
      var exact_layer_width = width_remaining / num_sections_left;
      if (num_sections_left > 2) {
        var layer_width = Math.round(exact_layer_width);
      } else {
        var layer_width = Math.floor(exact_layer_width);
      }
      left_sections.push(layer_width);
      right_sections_reversed.push(layer_width);

      num_sections_left -= 2;
      width_remaining -= layer_width * 2;
    }

    if (width_remaining && num_sections_left > 0) left_sections.push(width_remaining);
    section_widths = section_widths.concat(left_sections);
    section_widths = section_widths.concat(right_sections_reversed.reverse());

    return section_widths;
  };

  /*
   * Ensure both sides have an equal width by adjust total width.
   */
  this.adjustMapSizeForNumberOfSections = function(options, section_widths) {
    var required_map_width = section_widths.reduce(
      function(a, b) { return a + b; }, 0);
    if (options.map_grid.width != required_map_width) {
      console.log('Reducing map width by {0}'.format(options.map_grid.width - required_map_width));
      options.map_grid.width = required_map_width;
    }
    return;

    var width = options.map_grid.width;
    var num_sections = options.num_sections;
    if (width % num_sections != 0) {
      if (num_sections == 2) {
        options.map_grid.width -= width % num_sections;
        console.log('Reducing map width by {0}'.format(width % num_sections));
      }
    }
  };

  this.getPositionOfSections = function(options) {
    var widths = options.section_widths;
    var divider_positions = [];
    var sum = 0;
    for (var i in widths) {
      var width = sum + widths[i];
      sum = width;
      divider_positions.push(width);
    }
    return divider_positions;
  };

  this.buildEmptyGameData = function(options, game) {
    game.occupied = this.buildOccupied(options);
    game.terrain_type = [];
    game.terrain = [];
    game.roads = [];
    for (var x=0; x < options.map_grid.width; x++) {
      game.terrain_type[x] = [];
      game.terrain[x] = [];
      game.roads[x] = [];
    }
  };

  this.buildOccupied = function(options) {
    var occupied = [];
    for (var x = 0; x < options.map_grid.width; x++) {
      occupied[x] = [];
      for (var y = 0; y < options.map_grid.height; y++) {
        occupied[x][y] = false;
      }
    }
    return occupied;
  };

  this.generateHeightMap = function(options, location_map) {
    var size = location_map.height_map.size;
    Noise.seed(Math.random());
    var noise = Noise[location_map.height_map.noise]
    var height_map = [];
    for (var x = 0; x < options.map_grid.width; x++) {
      height_map[x] = [];
      for (var y = 0; y < options.map_grid.height; y++) {
        var value = noise(x / options.map_grid.width / size, y / options.map_grid.height / size);
        height_map[x][y] =  Math.abs(value);
      }
    }
    return height_map;
  };

  this.addWater = function(options, game, location_map) {
    var water_level = location_map.water.water_level;
    for (var x = 0; x < options.map_grid.width; x++) {
      for (var y = 0; y < options.map_grid.height; y++) {
        var height = game.height_map[x][y];
        if (height >= 1 - water_level) {
          var data = { height: game.height_map[x][y] };
          var water_obj = new TerrainData("Water").add(data).stats;
          game.terrain_type[x][y] = water_obj;
          game.occupied[x][y] = true;
        }
      }
    }
  };

  this.addCities = function(options, game_object, estimated_cities, vertical_sections) {
    if (!vertical_sections) vertical_sections = 1;
    var cities = [];
    var sections = game_object.section_positions;
    var base = 0;

    for (var i=0; i<sections.length; i++) {
      for (var y=0; y<vertical_sections; y++) {
        var min_x = base;
        var max_x = sections[i];
        //var min_y = y * vertical_section_height;
        //var max_y = (1 + y) * vertical_section_height;
        var min_y = Math.round(y * options.map_grid.height / vertical_sections);
        var max_y = Math.round((1 + y) * options.map_grid.height / vertical_sections);

        var new_cities = this.addCitiesToSection(options, game_object, estimated_cities / options.num_sections, cities, min_x, max_x, min_y, max_y);

        cities = cities.concat(new_cities);

        base = sections[i];
      }
    }

    return cities;
  };

  this.addCitiesToSection = function(options, game_object, estimated_cities, other_cities, min_x, max_x, min_y, max_y) {
    if (max_y === undefined) max_y = options.map_grid.height;
    if (min_y === undefined) min_y = 0;
    var cities = [];
    var num_cities = 0;
    var num_tries = 0;
    var max_tries = 5;
    var max_cities = estimated_cities + 1;

    var width = max_x - min_x - 1;
    var height = max_y - min_y - 2;

    var min_separation = Math.floor(Math.sqrt((width * height) / estimated_cities)) * 3/4;
    var num_tiles = (max_y - min_y) * (max_x - min_x);
    var num_tiles_remaining = num_tiles;
    var bad_locations = [];

    var all_cities = other_cities.concat(cities);

    while (num_cities < estimated_cities && num_tries < max_tries) {
      num_tries += 1;
      for (var x = min_x; x < max_x; x++) {
        if (!bad_locations[x]) bad_locations[x] = [];
        for (var y = min_y; y < max_y; y++) {

          if (bad_locations[x][y]) continue;

          var at_map_edge = x == 0 || x == options.map_grid.width - 1 || y == 0 || y == options.map_grid.height - 1;
          if (at_map_edge) {
            bad_locations[x][y] = true;
            num_tiles_remaining -= 1;
            continue;
          }

          var is_too_near = false;
          var current_location = { x: x, y: y };
          var all_cities = other_cities.concat(cities);
          for (var i in all_cities) {
            if (Utility.getDistance(current_location, all_cities[i]) < min_separation) {
              is_too_near = true;
              break;
            }
          }

          if (is_too_near) {
            bad_locations[x][y] = true;
            num_tiles_remaining -= 1;
            continue;
          }

          var probability = estimated_cities / num_tiles_remaining;
          var value = Math.random();

          if (game_object.occupied[x][y]) {
            bad_locations[x][y] = true;
            num_tiles_remaining -= 1;
            continue;
          }
          if (value >= 1 - probability) { // create city
            num_cities += 1;
            var color = Math.ceil(game_object.height_map[x][y] * 255);

            game_object.occupied[x][y] = true;

            var side = this.getMapSide(game_object, x);
            var stats = {
              height: game_object.height_map[x][y], 
              side: side,
            };

            if (side !== undefined) {
              var faction = options.faction_data[options.factions[side]];
              var city_name = faction.cities[num_cities - 1];
              if (city_name !== undefined) stats.name = city_name;
            }

            var city_obj = new TerrainData("City").add(stats).stats;
            city_obj.x = x;
            city_obj.y = y;
            cities.push(city_obj);
            game_object.terrain_type[x][y] = city_obj;

            if (num_cities >= max_cities) return cities;
          }
        }
      }
    }

    return cities;
  };

  this.addTownsAroundCities = function(options, game_object, cities) {
    var town_locations = [];
    for (var i in cities) {
      var new_towns = this.addTownsAroundCity(options, game_object, cities[i], town_locations);
      town_locations = town_locations.concat(new_towns);
    }
    return town_locations;
  };

  this.addTownsAroundCity = function(options, game_object, city_location, other_towns) {
    var town_locations = [];
    var max_distance = 4;
    var nearby_coords = Utility.getPointsWithinDistance(city_location, max_distance, options.map_grid);
    var prob_of_placement = 1/4;
    var distance_modifier = function(x) { // x is distance
      return Math.abs((Math.sin(x-1)) / 8);
    }

    for (var i in nearby_coords) {
      var coord = nearby_coords[i];

      // skip if coordinate is too close to other towns
      var is_adjacent = false;
      var all_towns = other_towns.concat(town_locations);
      for (var i in all_towns) {
        if (Utility.getDistance(coord, all_towns[i]) <= 1.5) {
          is_adjacent = true;
          break;
        }
      }
      if (is_adjacent) continue;

      var distance = Utility.getDistance(city_location, coord);
      var probability = distance_modifier(distance);
      if (!game_object.occupied[coord.x][coord.y] && Math.random() < probability) {
        var town_stats = {
          side: this.getMapSide(game_object, coord.x),
        };

        var town_obj = new TerrainData("Town").add(town_stats).stats;
        game_object.terrain_type[coord.x][coord.y] = town_obj;
        game_object.occupied[coord.x][coord.y] = true;
        town_locations.push({ x: coord.x, y: coord.y });
      }
    }

    return town_locations;
  };

  this.getMapSide = function(options, x) {
    var divider_positions = options.section_positions;
    if (x < divider_positions[0]) {
      return 0;
    } else if (x < divider_positions[divider_positions.length - 2]) {
      return undefined;
    }
    return 1;
  };

  this.getSideBySection = function(options, section_num) {
    if (section_num == 0) {
      return 0;
    } else if (section_num < options.num_sections - 1) {
      return undefined;
    }
    return 1;
  },

  this.addFarms = function(options, game_object, cities) {

    for (var i in cities) {
      var city = cities[i];
      var center = city;
      var max_distance = options.max_farm_distance;
      var factor = options.farm_probability_factor;

      for (var x = center.x - max_distance; x <= center.x + max_distance; x++) {
        if (x < 0 || x > options.map_grid.width - 1) continue;
        for (var y = center.y - max_distance; y <= center.y + max_distance; y++) {
          if (y < 0 || y > options.map_grid.height - 1) continue;
          if (x == center.x && y == center.y) continue;
          var location = { x: x, y: y };
          var distance = Utility.getDistance(center, location);
          //var probability = Math.pow(factor, distance + 1);
          var probability = Math.pow(factor, Math.pow(distance, distance));
          if (!game_object.occupied[x][y] && Math.random() < probability) {

            game_object.occupied[x][y] = true;
            //var data = { side: this.getMapSide(options, x) };
            var data = { side: this.getMapSide(game_object, x )};
            var farm_obj = new TerrainData("Farm").add(data).stats;
            //farm_obj.side = this.getMapSide(options, x);
            game_object.terrain_type[x][y] = farm_obj;
            city.farms.push(location);
          }
        }
      }
    }
  };

  this.addTrees = function(options, game_object, location_map) {
    var trees = location_map.trees;
    this.generateRandomEntities(options, game_object, 'Tree', Noise[trees.noise], trees.size, trees.freq, true);
  };

  this.addGrass = function(options, game_object) {
    // MUST GO LAST - fill everything else with grass
    for (var x = 0; x < options.map_grid.width; x++) {
      for (var y = 0; y < options.map_grid.height; y++) {
        if (!game_object.occupied[x][y]) {
          /*
          var grass = Crafty.e('Grass');
          grass.at(x, y);
          grass.setHeight();
          */

          var stats = { height: game_object.height_map[x][y] };
          var grass_obj = new TerrainData("Grass").add(stats).stats;
          game_object.terrain_type[x][y] = grass_obj;
        }
      }
    }
  };

  // Creates a road on the map given a shortest-path solution.
  this.createRoad = function(options, path, including_end, is_supply_route_road) {
    var road = [];
    var end = path.length - 1;
    if (including_end) end = path.length;
    for (var i = 0; i < end; i++) {
      var x = path[i].x;
      var y = path[i].y;
      //var terrain = Game.terrain[x][y];
      var terrain_type = this.Game.terrain_type[x][y];

      var entity_obj = {};
      entity_obj.type = "Road";

      var is_supply_route = false;
      if (is_supply_route_road && i == end - 1) {
        entity_obj.is_supply_route = true;
      }
      road.push({ x: x, y: y});

      if (terrain_type == 'City' || terrain_type.type == "City") {
        continue;
      }

      if (terrain_type == "Water" || terrain_type.type == "Water") {
        entity_obj.type = "Bridge";
        entity_obj = new TerrainData(entity_obj.type).add(entity_obj).stats;
        this.Game.roads[x][y] = entity_obj;
        this.Game.terrain_type[x][y] = entity_obj;
        continue;
      }

      entity_obj = new TerrainData(entity_obj.type).add(entity_obj).stats;
      this.Game.roads[x][y] = entity_obj;
    }
    this.buildTerrainDataWithRoads(options, this.Game, this.Game.terrain_type, this.Game.roads);
    return road;
  };

  this.addSupplyRoad = function(options, game_object, cities, left_or_right) {
    var graph = this.Game.terrain_build_graph;
    if (this.Game.terrain_build_with_roads_graph !== undefined) {
      var graph = this.Game.terrain_build_with_roads_graph;
    }
    var grid = graph.grid;
    if (left_or_right === undefined) return false;
    if (left_or_right == "left") {
      var start_city = cities[0];
      for (var i in cities) {
        if (cities[i].x < start_city.x) {
          start_city = cities[i];
        }
      }
    } else {
      var start_city = cities[cities.length - 1];
      for (var i in cities) {
        if (cities[i].x > start_city.x) {
          start_city = cities[i];
        }
      }
    }

    if (start_city == undefined) return false;
    // cannot have supply city on end of map
    if (start_city.x == 0) return false;
    if (start_city.x == options.map_grid.width - 1) return false;

    var start = grid[start_city.x][start_city.y];
    var best_route = undefined;
    var best_cost = undefined;
    for (var j=0; j < options.map_grid.height; j+=1) {
      if (left_or_right == 'left') {
        var end = grid[0][j];
      } else {
        var end = grid[options.map_grid.width - 1][j];
      }
      var path = Pathfind.search(graph, start, end);
      var cost = Pathing.totalCost(path);
      if (best_route === undefined || cost < best_cost) {
        best_route = path;
        best_cost = cost;
      }
    }

    return this.createRoad(options, best_route, true, true);
  };


  this.addRoadsBetweenCities = function(options, game_object, cities) {
    if (cities.length >= 2) {
      for (var a = 0; a < cities.length; a++) {
        var start_city = cities[a];
        var closest = undefined;
        var least_cost = undefined;
        for (var b = a; b < cities.length; b++) {
          if (a == b) continue;
          var end_location = cities[b];
          if (game_object.terrain_build_with_roads_graph !== undefined) {
            var start = game_object.terrain_build_with_roads_graph.grid[start_city.x][start_city.y];
            var end = game_object.terrain_build_with_roads_graph.grid[end_location.x][end_location.y];
            var result = Pathfind.search(game_object.terrain_build_with_roads_graph, start, end);
          } else {
            var start = game_object.terrain_build_graph.grid[start_city.x][start_city.y];
            var end = game_object.terrain_build_graph.grid[end_location.x][end_location.y];
            var result = Pathfind.search(game_object.terrain_build_graph, start, end);
          }
          var total_cost = Pathing.totalCost(result);
          if (least_cost === undefined || total_cost < least_cost) {
            closest = result;
            least_cost = total_cost;
          }
        }
        // @TODO Figure out why the last call is always undefined
        if (closest === undefined) continue;
        this.createRoad(options, closest);
      }
    }
  };

  this.addSupplyRoads = function(options, game_object, cities, max_roads, offset) { // <-- requires refactor
    // Entities are placed left to right, so the first will be on the left.
    if (max_roads === undefined) max_roads = 1;
    if (offset === undefined) offset = 0;
    max_roads += offset;

    // @TODO Save the supply end point locations, but nothing else
    for (var i = 0 + offset; i < max_roads; i++) {
      var new_supply_road = this.addSupplyRoad(options, game_object, cities, 'left');
      game_object.player_supply_roads[0].push(new_supply_road);
    }
    var left_supply_route = game_object.player_supply_roads[0][0][game_object.player_supply_roads[0][0].length - 1];
    game_object.supply_route[0] = left_supply_route;

    for (var i = cities.length - 1 - offset; i > cities.length - 1 - max_roads; i--) {
      var new_supply_road = this.addSupplyRoad(options, game_object, cities, 'right');
      game_object.player_supply_roads[1].push(new_supply_road);
    }
    var right_supply_route = game_object.player_supply_roads[1][0][game_object.player_supply_roads[1][0].length - 1];
    game_object.supply_route[1] = right_supply_route;


    var left = game_object.supply_route[0];
    var right = game_object.supply_route[1];
  };

  /*
   * entity_name: eg. 'Water' or 'Tree'
   * noise: the noise function object to be used. Eg. Game.noise.perlin2
   * size: relative; larger number means larger lakes
   * frequency: // relative, between 0 and 1; larger number means more lakes.
   * occupied: the array to update when entities are placed
   */
  this.generateRandomEntities = function(options, game_object, entity_name, noise, size, frequency, update_occupied) {
    // Place entity randomly on the map using noise
    Noise.seed(Math.random());
    for (var x = 0; x < options.map_grid.width; x++) {
      for (var y = 0; y < options.map_grid.height; y++) {
        // Allows for somewhat hacky reuse of the function for pure randomness.
        if (noise == 'random') {
          var num_tiles = options.map_grid.width * options.map_grid.height;
          var frequency = size / num_tiles;
          var noise_value = Math.random();
        } else {
          var value = noise(x / options.map_grid.width / size, y / options.map_grid.height / size);
          var noise_value = Math.abs(value);
        }
        
        if (noise_value >= 1 - frequency && !game_object.occupied[x][y]) {
          var stats = {
            height: game_object.height_map[x][y],
            side: this.getMapSide(game_object, x),
          };
          var entity_obj = new TerrainData(entity_name).add(stats).stats;
          game_object.terrain_type[x][y] = entity_obj;
          if (update_occupied) {
            game_object.occupied[x][y] = true;
          }
        }
      }
    }
  };

  this.cleanRoads = function(options, roads) {
    for (var x in roads) {
      for (var y in roads[x]) {
        var road = roads[x][y];
        var location = { x: x, y: y };

        var point_sets = [
          [ // top left
            { x: -1, y: -1 },
            { x: -1, y: 0 },
            { x: 0, y: -1 },
          ],
          [ // top right
            { x: 0, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 0 },
          ],
          [ // bottom right
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          [ // bottom left
            { x: 0, y: 1 },
            { x: -1, y: 1 },
            { x: -1, y: 0 },
          ],
        ];

        function isRoadSquare(location, indices, roads) {
          var all_roads = true;
          for (i in indices) {
            var point = indices[i];
            var x = parseInt(location.x) + parseInt(point.x);
            var y = parseInt(location.y) + parseInt(point.y);
            if (!roads[x] || !roads[x][y]) {
              all_roads = false;
              break;
            }
          }
          return all_roads;
        }

        for (var i in point_sets) {
          var all_roads = isRoadSquare(location, point_sets[i], roads);
          if (all_roads) {
            console.log('---');
            console.log('found a square of roads at:');
            console.log(location);
          }
          // find which roads have 2 connections
            // delete one of them!
          //var points = 
        }

        // update roads graph (as normally done when updating roads)

      }
    }
  };

  this.updateMovementDifficultyData = function(options, game_object, terrain_list) {
    // update/create move difficulty Graph for pathfinding purposes
    var terrain_difficulty = [];

    for (var x = 0; x < options.map_grid.width; x++) {
      terrain_difficulty[x] = [];

      for (var y = 0; y < options.map_grid.height; y++) {
        var terrain = terrain_list[x][y];
        terrain_difficulty[x][y] = terrain_list[x][y].move_difficulty;
      }
    }

    game_object.terrain_difficulty = terrain_difficulty;
    game_object.terrain_graph = new Graph(terrain_difficulty);
    return game_object.terrain_graph;
  };

  this.updateBuildDifficultyData = function(options, game_object, terrain_list) {
    // update/create build difficulty Graph for pathfinding purposes
    var terrain_build_difficulty = [];

    for (var x = 0; x < options.map_grid.width; x++) {
      terrain_build_difficulty[x] = [];

      for (var y = 0; y < options.map_grid.height; y++) {
        var terrain = terrain_list[x][y];
        terrain_build_difficulty[x][y] = terrain_list[x][y].build_over;
      }
    }

    game_object.terrain_build_difficulty = terrain_build_difficulty;
    game_object.terrain_build_graph = new Graph(terrain_build_difficulty);
    return game_object.terrain_build_graph;
  };

  this.buildTerrainDataWithRoads = function(options, game_object, terrain_list, roads) {
    game_object.terrain_difficulty_with_roads = [];
    game_object.terrain_build_difficulty_with_roads = [];
    game_object.terrain_supply = [];
    game_object.sight_grid = [];

    var spotted = {};
    var sides = [0, 1];
    for (var i in sides) {
      var index = sides[i];
      var grids = {};
      grids.movement = [];
      spotted[index] = grids;
    }
    game_object.spotted = spotted;


    for (var x = 0; x < terrain_list.length; x++) {
      game_object.terrain_difficulty_with_roads[x] = [];
      game_object.terrain_build_difficulty_with_roads[x] = [];
      game_object.terrain_supply[x] = [];
      game_object.sight_grid[x] = [];
      spotted[0].movement[x] = [];
      spotted[1].movement[x] = [];

      for (var y = 0; y < terrain_list[x].length; y++) {
        var terrain = terrain_list[x][y];
        this.updateTerrainGrids(game_object, terrain, roads, x, y);
        this.updateSpottedGrids(game_object, terrain, roads, x, y);
      }
    }

    game_object.terrain_with_roads_graph = new Graph(game_object.terrain_difficulty_with_roads);
    game_object.terrain_build_with_roads_graph = new Graph(game_object.terrain_build_difficulty_with_roads);
    game_object.terrain_supply_graph = new Graph(game_object.terrain_supply);
  };

  /*
   * Update all sides' spotted grids based on a terrain tile.
   */
  this.updateSpottedGrids = function(game_object, terrain, roads, x, y) {
    var sides = [0, 1];
    for (var i in sides) {
      this.updateSideSpottedGrids(game_object, terrain, roads, x, y, sides[i]);
    }
  };

  /*
   * Update spotted grids for a specific side based on a terrain tile.
   */
  this.updateSideSpottedGrids = function(game_object, terrain, roads, x, y, side) {
    var old_value = game_object.spotted[side].movement[x][y];
    var value;
    if (roads[x] && roads[x][y]) {
      value = roads[x][y].move_difficulty;
    } else if (terrain.move_difficulty !== undefined) {
      value = terrain.move_difficulty;
    } else {
      value = old_value;
    }
    game_object.spotted[side].movement[x][y] = value;
  };

  /*
   * Updates terrain grids given a terrain tile.
   * Eg. grids for movement, sight, etc.
   */
  this.updateTerrainGrids = function(game_object, terrain, roads, x, y) {
    try {
      game_object.terrain_difficulty_with_roads[x][y] = roads[x][y].move_difficulty || terrain.move_difficulty;
      game_object.terrain_build_difficulty_with_roads[x][y] = roads[x][y].build_over;
      game_object.terrain_supply[x][y] = roads[x][y].supply;
    } catch (ex) {
      game_object.terrain_difficulty_with_roads[x][y] = terrain.move_difficulty;
      game_object.terrain_build_difficulty_with_roads[x][y] = terrain.build_over;
      game_object.terrain_supply[x][y] = terrain.supply ? 1 : 0;
    }

    var sight_data = {
      sight_impedance: terrain.sight_impedance,
      x: x,
      y: y,
    };
    game_object.sight_grid[x][y] = sight_data;
  };

  this.buildTerrainData = function(options, game_object, terrain_list) {
    // build Game.terrain Graph for pathfinding purposes
    var terrain_difficulty = [];
    var terrain_build_difficulty = [];

    for (var x = 0; x < terrain_list.length; x++) {
      terrain_difficulty[x] = [];
      terrain_build_difficulty[x] = [];

      for (var y = 0; y < terrain_list[x].length; y++) {
        terrain_difficulty[x][y] = terrain_list[x][y].move_difficulty;
        terrain_build_difficulty[x][y] = terrain_list[x][y].build_over;
      }
    }

    //Game.terrain_type = terrain_type;
    game_object.terrain_difficulty = terrain_difficulty;
    game_object.terrain_build_difficulty = terrain_build_difficulty;

    // Uncomment below for Supply overlay
    /*
    var supply_objects = Crafty('Supply').get();
    for (var i=0; i<supply_objects.length; i++) {
      supply_objects[i].destroy();
    }

    for (var x=0; x<terrain_supply.length; x++) {
      for (var y=0; y<terrain_supply[x].length; y++) {
        if (terrain_supply[x][y]) {
          //Crafty.e("Supply").at(x, y);
        }
      }
    }
    */

    game_object.terrain_graph = new Graph(terrain_difficulty);
    game_object.terrain_build_graph = new Graph(terrain_build_difficulty);
  };

  this.createUnitFromFaction = function(faction_name, faction, side, location, index) {
    var unit_faction_data = {};
    Utility.loadDataIntoObject(faction.units[index], unit_faction_data);
    /*
    var name = faction.units[index].name;
    var quantity = faction.units[index].quantity;
    var type = faction.units[index].type;
    */
    var sprite = faction.sprites[unit_faction_data.type];
    if (sprite === undefined) {}

    var new_unit_data = this.createNewUnitData(unit_faction_data, side, location, index, faction.special_abilities);
    if (sprite) new_unit_data.addComponent(sprite);
    return new_unit_data;
  };

  this.addStartingUnits = function(options, game_object) {

    this.getStartY = function(side, max_units_per_column) {
      var supply_road = game_object.player_supply_roads[side][0];
      var y = supply_road[supply_road.length - 1].y;
      var min_y = Math.max(y - Math.floor(max_units_per_column/2), 0);
      var max_y = Math.min(min_y, options.map_grid.height - max_units_per_column);
      return max_y;
    };

    this.addUnits = function(side, x_value) {
      var units = [];
      var faction = options.faction_data[options.factions[side]];
      var units_left = faction.units.length;
      var current_index = 0;
      var column = 0;

      while (units_left > 0) {
        var max_units_per_column = 3;
        for (var i = 0; i<max_units_per_column; i++) {
          var y = this.getStartY(side, max_units_per_column);
          var spot = {x: x_value + column, y: y + i};
          var local_terrain = game_object.terrain_type[spot.x][spot.y].type;

          if (local_terrain == 'Water' || local_terrain.type == 'Water') {
          } else {
            var unit_obj = this.createUnitFromFaction(options.factions[side], faction, side, spot, current_index);
            units.push(unit_obj.stats);
            units_left -= 1;
            current_index += 1;
            if (!units_left) break;
          }
        }
        if (x_value == 0) {
          column += 1;
        } else {
          column -= 1;
        }
      }

      return units;
    };

    var units = [];
    units.push(this.addUnits(options.FIRST_PLAYER, 0));
    units.push(this.addUnits(options.SECOND_PLAYER, options.map_grid.width - 1));

    return units;
  };

  this.createNewUnitData = function(faction_data, side, location, unit_number, special_abilities) {

    faction_data.id = "side{0}_number{1}".format(side, unit_number);
    var unit_object = new UnitData(faction_data.type, faction_data);
    var rank = unit_number + 1;
    unit_object.add({ side: side, location: location, rank: rank });
    var special_abilities = this.getSpecialAbilities(unit_object, special_abilities);
    for (var i in special_abilities) {
      var ability = special_abilities[i];
      var object = {};
      object[ability] = true;
      unit_object.add(object);
      unit_object.stats.special_abilities.push(ability);
    }
    return unit_object;
  };

  this.getSpecialAbilities = function(unit_object, faction_abilities) {
    var special_abilities = [];
    for (var key in faction_abilities) {
      var special_ability;
      var ability = faction_abilities[key];
      if (ability === Object(ability)) {
        var type = unit_object.type.toLowerCase();
        if (!ability[type]) continue;
        special_ability = key;
      } else {
        special_ability = ability;
      }

      special_abilities.push(special_ability);
    }

    return special_abilities;
  };

  this.buildNewComposedMap = function(options) {
    this.Game.height_map = this.generateHeightMap(options, options.location);
    this.buildEmptyGameData(options, this.Game);
    this.addWater(options, this.Game, options.location);

    this.Game.section_widths = this.getWidthOfSections(options);
    this.Game.section_positions = this.getPositionOfSections(this.Game);
    //var city_locations = this.addCities(options, this.Game, options.num_cities_total, 1);
    var city_locations = this.addCities(options, this.Game, options.num_cities_total, 1);
    console.log("city_locations");
    console.log(city_locations);
    //var city_locations = this.addCities(options, this.Game, 1, 2);
    this.addFarms(options, this.Game, city_locations);
    this.addTrees(options, this.Game, options.location);
    this.addGrass(options, this.Game);

    //this.updateBuildDifficultyData(options, this.Game.terrain_type);
    this.buildTerrainData(options, this.Game, this.Game.terrain_type);
    this.addSupplyRoads(options, this.Game, city_locations, 1);

    var halved_city_locations = [[], []];
    for (var i in city_locations) {
      var location = city_locations[i];
      if (location.y <= options.map_grid.height / 2) {
        halved_city_locations[0].push(location);
      } else {
        halved_city_locations[1].push(location);
      }
    }

    this.addRoadsBetweenCities(options, this.Game, halved_city_locations[0]);
    this.addRoadsBetweenCities(options, this.Game, halved_city_locations[1]);
    this.addRoadsBetweenCities(options, this.Game, [halved_city_locations[0][0], halved_city_locations[1][0]]);
    //this.addRoadsBetweenCities(options, this.Game, city_locations);

    this.Game.starting_units = this.addStartingUnits(options, this.Game);
    /*

    if (Game.fog_of_war) {
      shadowHeightMap(Game.location);
      LineOfSight.clearFog();
    }
    */

   var map_data = {};
   map_data.terrain_type = this.Game.terrain_type;
   map_data.height_map = this.Game.height_map;
   map_data.player_supply_roads = this.Game.player_supply_roads;
   map_data.supply_route = this.Game.supply_route;

   return this.Game;
  };



};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = MapCreator;
} else {
  window.MapCreator = MapCreator;
}
