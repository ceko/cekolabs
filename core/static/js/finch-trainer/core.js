window.finch = {}
/** backbone models **/

/** magicka button combination controls **/
window.models = { controls: {} };

models.StatsOverview = Backbone.Model.extend({
	initialize: function() {
		this.set({
			games_played: 0,		
			fumbles: 0,
			total_objectives: 0,
			fumble_percentage: 0,
			best_time: 0,
			worst_time: 0,
			average_time: 0,
			
			offensive_games_played: 0,
			offensive_total_spells_cast: 0,
			offensive_total_kills: 0,
			offensive_favorite_combo: [],
			offensive_favorite_element: null,
		});
	},
	update: function() {
		var round_history = finch.game.round_history.get('history');
		var games_played = 0;
		var total_objectives = 0;
		var best_time = Infinity;
		var worst_time = 0;
		var average_time = 0;

		var fumbles = 0;
		var fumble_percentage = 0;
		
		var offensive_games_played = 0;
		var offensive_total_spells_cast = 0;		
		var offensive_combo_counter = [];
		var offensive_element_counter = [];
		
		for(var i=0;i<round_history.length;i++) {			
			if(round_history[i].label == 'offensive') {
				offensive_games_played++;
				offensive_total_spells_cast+=round_history[i].history.length;
				
				//gives hashes like fire-fire-life or arcane-earth-earth
				var combo_hashes = round_history[i].history.map(function(h) { return h.element_queue.sort().join('-') });
				for(j=0;j<combo_hashes.length;j++) {
					if(!offensive_combo_counter[combo_hashes[j]])
						offensive_combo_counter[combo_hashes[j]] = 0;
					
					offensive_combo_counter[combo_hashes[j]]++;
				}
				
				var element_queues = round_history[i].history.map(function(h) { return h.element_queue; });
				for(j=0;j<element_queues.length;j++) {
					element_queues[j].map(function(e) { 
						if(!offensive_element_counter[e])
							offensive_element_counter[e] = 0;
						
						offensive_element_counter[e]++;
					});					
				}								
			}else{
				games_played++;
							
				for(var j=0;j<round_history[i].history.length;j++) {				
					best_time = Math.min(best_time, round_history[i].history[j].time_to_complete);
					worst_time = Math.max(worst_time, round_history[i].history[j].time_to_complete);
					average_time = (average_time * total_objectives + round_history[i].history[j].time_to_complete) / (total_objectives+1);
					if(round_history[i].history[j].fumble) {
						fumbles++;
					}
					total_objectives++;
				}
			}
		}
		
		var get_highest_key = function(array) {			
			var max = -Infinity;
			var max_key = null;
			
			for(var i in array) {
				if(array.hasOwnProperty(i)) {
					if(array[i] > max) {
						max = array[i];
						max_key = i;
					}					
				}
			}
			
			return max_key;
		};
		
		this.set({
			games_played: games_played,
			fumbles: fumbles,
			total_objectives: total_objectives,
			fumble_percentage: total_objectives == 0 ? 0 : Math.floor(fumbles/total_objectives*100),
			best_time: total_objectives == 0 ? 0 : best_time,
			worst_time: worst_time,
			average_time: Math.floor(average_time),
			
			offensive_games_played: offensive_games_played,
			offensive_total_spells_cast: offensive_total_spells_cast,
			offensive_favorite_combo: get_highest_key(offensive_combo_counter) ? get_highest_key(offensive_combo_counter).split('-') : null,
			offensive_favorite_element: get_highest_key(offensive_element_counter) ? get_highest_key(offensive_element_counter) : null,
		});
		this.trigger('statistics_updated');
	}
});

models.controls.Elements = Backbone.Model.extend({
	suppress_fizzle: false,
	show_cast_bar: false,
	ignore_keystrokes: false,
	casting_interval: null,
	combo_parser: null,
	casting_combo_parser: null,	
	initialize: function() {
		this.set({
			queued_elements: [],	
			pressed_elements: [],
			casting_power: 0,
			casting: false,
		});		
		this.incompatibility_list = [			
			['life', 'arcane'],
			['shield', 'shield'],
			['cold', 'fire'],
			['lightning', 'earth'],
			['lightning', 'water']
		];
		finch.game.views.global.on('right_mouse_press', this.handle_right_mouse_press.bind(this));
		finch.game.views.global.on('right_mouse_release', this.handle_right_mouse_release.bind(this));
		finch.game.views.global.on('left_mouse_press', this.handle_left_mouse_press.bind(this));
		finch.game.views.global.on('left_mouse_release', this.handle_left_mouse_release.bind(this));
				
		var _this = this;
		this.on('change:queued_elements', function() {
			_this.combo_parser = null;
		});
		
		$(function() { _this.load_keybindings(); });
	},
	persist_keybindings: function() {		
		$.cookie('keybindings', JSON.stringify({
			elements: this.keybindings,
			mouse_cast_button: this.mouse_cast_button,
		}));
	},
	load_keybindings: function() {
		var keybindings = $.cookie('keybindings');
		if(keybindings) {
			keybindings = JSON.parse(keybindings);
			this.keybindings = keybindings.elements;
			this.mouse_cast_button = keybindings.mouse_cast_button;
		}else{
			this.keybindings = {
				'Q': 'water',
				'W': 'life',
				'E': 'shield',
				'R': 'cold',
				'A': 'lightning',
				'S': 'arcane',
				'D': 'earth',
				'F': 'fire'
			};
			this.mouse_cast_button = 'right';
		}
		
		this.trigger('change:keybindings');
	},
	process_cookie: function() {
		var audio_settings = $.cookie('audio-settings');
		if(audio_settings) {
			this.is_first_time = false;
			var settings = JSON.parse(audio_settings);
			this.volume = settings.volume;
			this.playing = settings.playing;
		}else{
			this.save_cookie();
		}
	},
	save_cookie: function() {
		$.cookie('audio-settings', JSON.stringify({
			playing: this.playing,
			volume: this.volume,
			is_first_time: this.is_first_time
		}));
	},
	clear_queued_elements: function() {
		this.set('queued_elements', []);		
	},
	get_casting_elements: function() {
		if(this.casting_combo_parser)
			return this.casting_combo_parser.get('elements');
		else
			return [];
	},
	get_combo_parser: function() {
		if(!this.combo_parser) {
			this.combo_parser = new models.ComboParser();
			this.combo_parser.set_elements(this.get('queued_elements'));
		}
		
		return this.combo_parser;
	},	
	get_random_elements: function(includes, excludes) {		
		excludes = excludes || [];
		var elements = [];
		//if includes has excludes in it, remove them
		includes = _.difference(includes, excludes);
		if(includes && includes.length) {
			elements = includes.slice(0);
		}
				
		while(elements.length < 3) {
			var keybinding_index = Math.floor(Math.random()*8);
			var cnt = 0;
			var proposed_element = null;
			for(key in this.keybindings) {
				if(this.keybindings.hasOwnProperty(key)) {
					if(cnt == keybinding_index) {
						proposed_element = this.keybindings[key];
						break;
					}
						
					cnt++;
				}			
			}
			
			if(excludes.indexOf(proposed_element) !== -1)
				continue;
			
			var incompatibility_index = this.element_incompatibility_index(proposed_element, elements);
			if(incompatibility_index == -1) {
				elements.push(proposed_element);
			}
		}
		
		return elements;
	},
	queue_random_elements: function() {
		this.suppress_fizzle = true;
		this.clear_queued_elements();
		
		var elements = this.get_random_elements();
		var queued_elements = this.get('queued_elements');
		
		for(var i=0;i<elements.length;i++) {			
			if(queued_elements.length < 3) {
				queued_elements.push(elements[i]);				
			}								
		}
		this.set('queued_elements', queued_elements);
		this.trigger('change:queued_elements', this, queued_elements);
		this.suppress_fizzle = false;		
	},
	matches_elements: function(elements) {
		var element_arr1 = this.get('queued_elements').slice(0);
		var element_arr2 = elements.slice(0);
		var el1;
		while(el1 = element_arr1.pop()) {
			var idx = element_arr2.indexOf(el1);
			if(idx > -1) {
				element_arr2.splice(idx,1);
			}else{
				return false;
			}
		}
		
		return element_arr1.length == 0 & element_arr2.length == 0;
	},
	handle_left_mouse_press: function() {
		if(this.mouse_cast_button == 'left') {
			this.bound_mouse_press();
		}
	},
	handle_right_mouse_press: function() {
		if(this.mouse_cast_button == 'right') {
			this.bound_mouse_press();
		}
	},
	bound_mouse_press: function() {
		if(!this.show_cast_bar)
			return;
		
		var combo_parser = this.get_combo_parser();			
		combo_parser.determine_spell_type();
		this.casting_combo_parser = combo_parser;
		
		if(this.get('queued_elements').length) {
			this.trigger('cast_start');
			if(this.combo_is_instant_cast()) {
				switch(combo_parser.get_spell_type()) {
					case 'SHIELD':
						finch.game.message_box.set_message('shields not supported');
						finch.game.controls.elements.clear_queued_elements();
						break;
					case 'MINES':
						finch.game.message_box.set_message('mines not supported');
						finch.game.controls.elements.clear_queued_elements();
						break;
					case 'ROCK_WALL':
						finch.game.message_box.set_message('walls not supported');
						finch.game.controls.elements.clear_queued_elements();
						break;
					case 'STORM':
						finch.game.message_box.set_message('storms not supported');
						finch.game.controls.elements.clear_queued_elements();
						break;
					case 'ELEMENTAL_BARRIER':
						finch.game.message_box.set_message('storms not supported');
						finch.game.controls.elements.clear_queued_elements();
						break;				
					
				}
				return;
			}
			
			var _this = this;
			
			var casting_interval_function = function() {
				_this.set('casting', true);
				if(_this.casting_combo_parser.is_channeled()) {
					_this.spell_landed(_this.casting_combo_parser, null, _this.get('casting_power'));
					_this.trigger('spell_channeling');				
				}
				if(_this.get('casting_power') >= 100) {
					_this.stop_casting();					
					_this.set('casting_power', 0);
					return;
				}				
				_this.set('casting_power', _this.get('casting_power')+_this.casting_combo_parser.get_power_interval());
			};
			
			if(this.combo_is_channeled() || this.combo_is_charged()) {
				clearInterval(this.casting_interval);
				this.casting_interval = setInterval(casting_interval_function, 150);
				casting_interval_function.call(_this);
			}else{
				this.stop_casting();
			}
			
			finch.game.controls.elements.clear_queued_elements();
		}
	},
	combo_is_instant_cast: function() {
		return this.get_combo_parser().is_instant_cast();
	},
	combo_is_channeled: function() {
		return this.get_combo_parser().is_channeled();
	},
	combo_is_charged: function() {
		return this.get_combo_parser().is_charged();
	},
	handle_left_mouse_release: function() {
		if(this.mouse_cast_button == 'left') {
			this.bound_mouse_release();
		}
	},
	handle_right_mouse_release: function() {
		if(this.mouse_cast_button == 'right') {
			this.bound_mouse_release();
		}
	},
	bound_mouse_release: function() {
		if(!this.show_cast_bar)
			return;		
		this.stop_casting();		
	},
	spell_landed: function(combo_parser, y, cast_power) {
		//this is called when a spell may hit the opponent.  sometimes the view
		//is responsible for calling this method.  the reason why i use the view
		//is because certain things (like projectiles) have variable travel time and it can be 
		//difficult to calculate that in the model.  for most spells though i can
		//skip a tick and then calculate damage (like fire)
		
		//this will be greater than 0 if the spell damages rock walls.  if it is called it
		var rock_health_subtractor = 0;
		
		/* This is an array of damage, looks like so:
		 *
		 * [0] => { element: fire, damage: 50, aoe: true, missed: false }
		 * [1] => { element: earth, damage: 20, aoe: false, missed: true }
		 * [2] => { element: arcane, damage: 35, aoe: true, missed: false }
		 * 
		 */
		 		
		var damage_components = combo_parser.get_damage_components(cast_power);
		var projectile_limit = 110;
		var aoe_limit = 210;
		var spell_blocked = false;
		var power_lower_limit = 0; /* anything under this power will not register damage */
		var dispel_water_wall = false;
		
		switch(combo_parser.get_spell_type()) {		
			case 'ROCK_PROJECTILE':
				rock_health_subtractor = 2;
				spell_blocked = finch.game.opponent.get("wall_active");
				break;
			case 'SPRAY':
				//cold spray dispells water wall
				if(combo_parser.has_element('cold') || combo_parser.has_element('fire'))
					dispel_water_wall = true;
				power_lower_limit = 30;
				rock_health_subtractor = .5;
				spell_blocked = finch.game.opponent.get("wall_active") || finch.game.opponent.get("shield_active");
				break;
			case 'ICE_SHARDS':				
				rock_health_subtractor = 2;
				spell_blocked = finch.game.opponent.get("wall_active");
				aoe_limit = 110;
				break;
			case 'BEAM':
				power_lower_limit = 30;
				rock_health_subtractor = 1;
				spell_blocked = finch.game.opponent.get("wall_active") || finch.game.opponent.get("shield_active");
				break;
			case 'LIGHTNING':
				rock_health_subtractor = .4;
				spell_blocked = finch.game.opponent.get("wall_active") || finch.game.opponent.get('water_wall_active');
				break;				
		}
		
		if(cast_power >= power_lower_limit) {	
			if(dispel_water_wall)
				finch.game.opponent.set('water_wall_active', false);
			if(!y || y < 220 && y > 150)
				finch.game.opponent.hurt_wall(rock_health_subtractor);
			
			if(!spell_blocked) {		
				if(y) {
					for(i=0;i<damage_components.length;i++) {			
						if(y > projectile_limit && !damage_components[i].aoe) { //didn't hit the player, remove any non-aoe damage					
							damage_components[i].missed = true;					
						}else if(y > aoe_limit && damage_components[i].aoe) { //out of aoe range					
							damage_components[i].missed = true;					
						}
					}
				}
				
				finch.game.opponent.register_damage(damage_components, combo_parser);
			}
		}
	},
	stop_casting: function() {
		this.set('casting', false);		
		this.trigger('cast_stop');		
		this.set('casting_power', 0);
		this.casting_interval = clearInterval(this.casting_interval);
		if(this.get('casting_power') > 0 || this.casting_combo_parser && this.casting_combo_parser.is_instant_cast() && this.get_casting_elements().length) {			
			this.trigger('spell_cast', Math.min(100, this.get('casting_power')));			
		}				
		this.casting_combo_parser = null;		
	},
	handle_keydown: function(key) {
		var element = this.keybindings[key];
		var pressed_elements = this.get('pressed_elements');
		if(element) {
			pressed_elements[element] = true;
			this.set('pressed_elements', pressed_elements);
			this.trigger('change:pressed_elements', this, pressed_elements);
			
			this.trigger('element_queue_try');
			var incompatibility_index = (this.element_incompatibility_index(element, this.get('queued_elements')));
			var queued_elements = this.get('queued_elements');
			
			if(incompatibility_index == -1 /* no incompatibilities found */) {
				if(queued_elements.length < 3) {
					queued_elements.push(element);					
				}								
			}else{
				//show a fizzle, queued an incompatible element
				if(!this.suppress_fizzle)
					this.trigger('element_fizzle', this, incompatibility_index, element);
				
				queued_elements.splice(incompatibility_index, 1);				
			}
			
			this.set('queued_elements', queued_elements);
			this.trigger('change:queued_elements', this, queued_elements);
		}
	},
	handle_keyup: function(key) {		
		var element = this.keybindings[key];		
		if(element) {
			var pressed_elements = this.get('pressed_elements');
			delete pressed_elements[element];
			this.set('pressed_elements', pressed_elements);
			this.trigger('change:pressed_elements', this, pressed_elements);
		}
	},
	element_incompatibility_index: function(element, element_list) {
		for(i=0;i<this.incompatibility_list.length;i++) {
			var check_set = this.incompatibility_list[i];
			//iterate through specific incompatibility
			for(j=0;j<check_set.length;j++) {
				//this element is in the list, check queued elements from last to first
				if(check_set[j] == element) {
					var found_at = j; //skip this when checking queued.
					for(k=0;k<check_set.length;k++) {
						if(k != found_at) {
							var incompatibility_index = element_list.lastIndexOf(check_set[k]);
							if(incompatibility_index !== -1) {
								return incompatibility_index;
							}
						}
					}					
				}
			}
		}
		
		return -1;
	}	
});

models.ComboParser = Backbone.Model.extend({
	initialize: function() {
		this.set({
			/* cast targets: 
			 * SELF
			 * ENEMY
			 */
			'cast_target': 'SELF',
			/* spell types:
			 * WARD
			 * SHIELD
			 * MINES
			 * ROCK_WALL
			 * STORM
			 * ELEMENTAL_BARRIER
			 * ROCK_PROJECTILE
			 * ICE_SHARDS
			 * BEAM
			 * SPRAY
			 */
			'spell_type': null,
		});
	},
	set_elements: function(elements) {
		this.set('elements', elements);
	},
	has_element: function(element) {
		return $.inArray(element, this.get('elements')) != -1; 
	},
	set_cast_target: function(target) {
		this.set('cast_target', target);
	},
	get_power_interval: function() {
		var interval = 10;
		if(this.get_spell_type() == 'LIGHTNING')
			interval = 20;
		
		return interval;
	},
	get_spell_type: function() {
		if(!this.get('spell_type')) {
			this.determine_spell_type();
		}
		return this.get('spell_type');
	},
	contains_steam: function() {
		var elements = this.get('elements');
		return $.inArray('water', elements) != -1 && $.inArray('fire', elements) != -1;
	},
	contains_ice: function() {
		var elements = this.get('elements');
		return $.inArray('water', elements) != -1 && $.inArray('cold', elements) != -1;
	},
	get_status_application_speed: function() {
		switch(this.get_spell_type()) {
			case 'ROCK_PROJECTILE':
				return 2;				
			case 'SPRAY':
				return .2;				
			case 'ICE_SHARDS':
				return 0;
			case 'BEAM':
				return .2;
			case 'LIGHTNING':
				return .4;			 
			default:
				return 1;
		}
	},
	get_damage_components: function(power) {
		if(!power)
			power = 100;
				
		var components = [];
		var elements = this.get('elements');
		var base_damage_table = {
			'water': 0,
			'life': -30,
			'shield': 0,
			'cold': 20,
			'lightning': 20,
			'arcane': 30,
			'earth': 60,
			'fire': 40	
		};
		
		for(i=0;i<elements.length;i++) {
			var element = elements[i];
			var base_damage = base_damage_table[element];
			var total_damage = 0;
			var aoe = false;
			
			switch(this.get_spell_type()) {
				case 'ROCK_PROJECTILE':
					aoe = element != 'earth';
					total_damage = base_damage * power / 100;
					break;
				case 'SPRAY':
					total_damage = base_damage * .20;
					break;
				case 'ICE_SHARDS':
					aoe = false;
					total_damage = base_damage * power / 100;
					break;
				case 'BEAM':
					total_damage = base_damage * .2;
					break;
				case 'LIGHTNING':
					total_damage = base_damage * .25;
					break;			 
				default:
					total_damage = base_damage * power / 100;
					break;
			}
			
			components.push({ element: element, damage: total_damage, aoe: aoe, missed: false });
		}
		
		return components;
	},
	determine_spell_type: function() {
		var elements = this.get('elements');
		var spell_type = 'UNKNOWN';
		var elements_contain = function(element) {
			return $.inArray(element, elements) != -1;
		}
		
		if(this.is_instant_cast()) {
			if(elements.length == 1) {
				spell_type = 'SHIELD';
			}else if(elements_contain('lightning')) {
				spell_type = 'STORM';
			}else if(elements_contain('earth')) {
				spell_type = 'ROCK_WALL';
			}else if(elements_contain('arcane')) {
				spell_type = 'MINES';
			}else{
				spell_type = 'ELEMENTAL_BARRIER';
			}
		}else if(this.is_channeled()) {
			if(elements_contain('lightning')) {
				spell_type = 'LIGHTNING';
			}else if(elements_contain('life') || elements_contain('arcane')) {
				spell_type = 'BEAM';
			}else {
				spell_type = 'SPRAY';
			}
		}else if(this.is_charged()) { 
			if(elements_contain('earth')) {
				spell_type = 'ROCK_PROJECTILE';
			}else {
				spell_type = 'ICE_SHARDS';
			}
		}
		
		this.set('spell_type', spell_type);
	},
	is_instant_cast: function() {
		/*instant cast:  
		 * wards - middle mouse button E[XX], can't cast
		 * bubble - E
		 * mines - ES[X]
		 * elemental walls - ED[X]
		 * lightning storms - EA[X]
		 * elemental barriers - E[!SDA][X]		 
		 */
		var shield_index = $.inArray('shield', this.get('elements'));
		return shield_index !== -1;
	},
	is_channeled: function() {
		/* channeled:
		 * !instant		 
		 * !charged [can stop here]
		 * beams: [W|S][XX]
		 * lightning: A[XX]
		 * sprays: [Q|R|F][XX]
		 */		
		return !this.is_instant_cast() && !this.is_charged();
	},
	is_charged: function() {
		/* charged:
		 * !instant		  
		 * rock attacks: D[XX]
		 * shard attacks: QR[X]
		 */
		var elements = this.get('elements');
		var elements_contain = function(element) {
			return $.inArray(element, elements) != -1;
		}
		return !this.is_instant_cast() 
			   && elements_contain('earth')
			   || (elements_contain('water') && elements_contain('cold'));
	}
	
});

models.Opponent = Backbone.Model.extend({
	ai_timeout: null,
	wall_expire_timeout: null,
	water_wall_expire_timeout: null,
	shield_expire_timeout: null,
	fire_expire_timeout: null,
	fire_damage_timeout: null,
	fire_damage_ticks_left: null,
	wet_expire_timeout: null,
	thaw_timer: null,
	cast_timeout: null,
	spell_gap: 1700,
	last_spell_cast: 0,
	spell_delay_modifier: 1,
	max_health: 1500,
	initialize: function() {				
		var _this = this;
		this.on('change:wall_active', function() {
			_this.wall_expire_timeout = clearTimeout(_this.wall_expire_timeout);
		});
		this.on('change:shield_active', function() {
			_this.shield_expire_timeout = clearTimeout(_this.shield_expire_timeout);
		});
		this.set_default_values();
	},
	set_default_values: function() {
		this.set({
			'outer_ward': null,
			'inner_ward': null,
			'shield_active': false,
			'wall_active': false,
			'water_wall_active': false,
			'casting': false,
			'wet': false,
			'frozen_level': 0,
			'on_fire': false,
			'health': this.max_health			
		});
	},
	ai_step: function() {
		var time = (new Date()).getTime();
		if(time - this.last_spell_cast > this.spell_gap) {			
			//what is user casting
			
			/*set wards based on conditions:
			 *  - what's being cast
			 *  - what's status of the character (frozen, wet, fire)
			 *  - what's the health of the character 
			 *  - nothing happening?  change ward, cast wall, heal a bit
			 */
			
			var elements = finch.game.controls.elements.get_casting_elements();
			var casting = finch.game.controls.elements.get('casting');
			var combo_parser = finch.game.controls.elements.casting_combo_parser;
			
			var spell = null;
			var _this = this;
			var cast_time = 1000;
			
			//reactive spells... change wards, put up walls, whatever
			if(casting) {
				switch(combo_parser.get_spell_type()) {
					case 'SPRAY':
					case 'BEAM':
						if(!this.get('shield_active'))
							spell = this.cast_shield;
						
						break;
					case 'ROCK_PROJECTILE':
						if(!this.get('wall_active'))
							spell = this.cast_wall;
						break;
					case 'LIGHTNING':
						var possible_spells = [];
						var total_affinity = 0;
						if(!this.get('water_wall_active')) {
							possible_spells.push({
								spell: this.cast_water_wall,
								cast_time: 500,
								affinity: 5,
							});					
							total_affinity += 5;
						}
						if(!this.get('wall_active')) {
							possible_spells.push({
								spell: this.cast_wall,
								cast_time: 750,
								affinity: 5,
							});					
							total_affinity += 5;
						}
						var ward_affinity = 10;
						total_affinity += ward_affinity;
						
						var selected_affinity = Math.floor(Math.random() * total_affinity)
						var affinity_cnt = 0;
						for(i=0;i<possible_spells.length;i++) {
							if(possible_spells[i].affinity + affinity_cnt <= selected_affinity) {
								spell = possible_spells[i].spell;
								cast_time = possible_spells[i].cast_time;
							}
							affinity_cnt += possible_spells[i].affinity;
						}
						break;
				}
				
				if(!spell) {
					//change wards based on what's cast
					var random_ward_elements = finch.game.controls.elements.get_random_elements(includes=elements, excludes=['life', 'shield']);
					cast_time = 500;
					if(random_ward_elements.length == 3) {
						spell = function() { this.set_wards(random_ward_elements[1], random_ward_elements[2]) };
					}
				}
			}
			
			if(!spell) {
				//downtime... remove debuffs, or heal
				if(this.get('health') < this.max_health) {
					spell = this.cast_heal;
					cast_time = 250;
				}
			}
			
			if(spell && !this.cast_timeout) {
				cast_time = cast_time * (1+2*(this.get('frozen_level')+.01) / 5); /* max freeze */
				
				this.last_spell_cast = time;
				this.last_cast_time = cast_time;
				this.set('casting', true);				
				var _this = this;
				this.cast_timeout = setTimeout(function() { 
					spell.call(_this);
					_this.cast_timeout = clearTimeout(_this.cast_timeout);
					_this.set('casting', false);
				}, cast_time*this.spell_delay_modifier);			
			}	
		}
		this.ai_timeout = setTimeout(this.ai_step.bind(this), 200);		
	},
	thaw: function() {
		this.set('frozen_level', Math.max(0, this.get('frozen_level')-.34));
	},
	cast_shield: function() {		
		var _this = this;
		this.set('shield_active', true);
		this.shield_expire_timeout = setTimeout(function() {
			_this.set('shield_active', false);
		}, 5000);
	},
	hurt_wall: function(amount) {
		this.wall_health -= amount;
		if(this.wall_health <= 0) {
			this.set('wall_active', false);
		}
	},
	cast_wall: function() {		
		this.wall_health = 2;
		this.set('wall_active', true);
		this.set('water_wall_active', false);
		this.water_wall_expire_timeout = clearTimeout(this.water_wall_expire_timeout);
		var _this = this;
		clearTimeout(this.wall_expire_timeout);
		this.wall_expire_timeout = setTimeout(function() {
			_this.set('wall_active', false);
		}, 5000);
	},
	cast_water_wall: function() {
		this.set('wall_active', false);
		this.set('water_wall_active', true);
		this.wall_expire_timeout = clearTimeout(this.wall_expire_timeout);
		var _this = this;
		clearTimeout(this.water_wall_expire_timeout);
		this.water_wall_expire_timeout = setTimeout(function() {
			_this.set('water_wall_active', false);
		}, 10000);
	},
	cast_heal: function() {
		this.trigger('heal_cast');
		this.set('health', Math.min(this.get('health')+125, this.max_health));
	},
	set_wards: function(inner_ward, outer_ward) {
		this.set({
			'inner_ward': inner_ward,
			'outer_ward': outer_ward
		});
	},
	set_starting_wards: function() {
		var random_ward_elements = finch.game.controls.elements.get_random_elements(includes=['shield'], excludes=['life']);
		this.set({
			'outer_ward': random_ward_elements[1],
			'inner_ward': random_ward_elements[2]
		});
		
	},
	register_damage: function(damage_components, combo_parser) {
		
		var status_application_func = null;		
		var physical_damage = 0;
		var total_damage = 0;
		var remove_wet = false;
		
		for(i=0;i<damage_components.length;i++) {
			var component = damage_components[i];
			if(!component.missed) {
				switch(component.element) {
					/*
					 * water : apply wet, remove fire
					 * life : nothing
					 * shield : nothing
					 * cold : apply frost
					 * lightning : check for wet, remove, double damage
					 * arcane: nothing
					 * earth: shatter if frozen
					 * fire: remove water, remove frozen, apply fire
					 */
			
					case 'water':
						if(this.ward_coverage('water') > 0) break; 
						
						if(!combo_parser.contains_steam() && !combo_parser.contains_ice())
							status_application_func = this.apply_wet_status;
						break;
					case 'cold':
						if(this.ward_coverage('cold') > 0) break;
						
						if(!combo_parser.contains_ice())
							status_application_func = this.apply_cold_status;
						break;
					case 'lightning':
						if(this.ward_coverage('lightning') == 1) break;
						
						if(this.get('wet')) {
							component.damage = component.damage * 2;
							remove_wet = true;
						}
						break;
					case 'earth':
						physical_damage += component.damage * (1-this.ward_coverage('earth'));
						break;
					case 'fire':
						if(this.ward_coverage('fire') > 0) break;
						
						if(!combo_parser.contains_steam())
							status_application_func = this.apply_fire_status;
						break;					
				}
				
				total_damage += component.damage * (1-this.ward_coverage(component.element));
			}
		}
				
		if(remove_wet) {
			this.set('wet', false);
		}
				
		if(!finch.game.paused) {
			this.set('health', this.get('health') - total_damage);
			if(status_application_func)
				status_application_func.call(this, combo_parser.get_status_application_speed());
		}
	},
	/* returns 0, .5 or 1 */
	ward_coverage: function(element) {
		var coverage = 0;
		if(this.get('inner_ward') == element)
			coverage += .5;
		if(this.get('outer_ward') == element)
			coverage += .5;
		
		return coverage;
	},
	apply_wet_status: function(status_application_speed) {
		/* i don't care for water about application speed */
		if(this.get('on_fire')) {			
			this.set('on_fire', false);		
		}else{
			this.set('wet', true);
		}
	},
	is_frozen: function() {
		return this.get('frozen_level') >= 5;
	},
	apply_cold_status: function(status_application_speed) {
		if(this.get('wet'))
			status_application_speed = status_application_speed * 2;
		
		if(!this.is_frozen()) {
			if(this.get('on_fire')) {
				this.set('on_fire', false);
			}else{
				var frozen_level = Math.min(5, this.get('frozen_level') + status_application_speed);
				this.set('frozen_level', frozen_level);
			}
		}
		
		this.set('wet', false);
	},
	apply_fire_status: function(status_application_speed) {
		if(this.get('frozen_level') > 0) {
			this.set('frozen_level', this.get('frozen_level') - 1);			
		}else if(this.get('wet')) {
			this.set('wet', false);
		}else{
			this.set('on_fire', true);			
			this.extend_fire_damage_dot();
		}
	},
	extend_fire_damage_dot: function() {
		var _this = this;
		if(!this.fire_damage_timeout) {
			var do_fire_damage = function() {
				_this.set('health', _this.get('health') - 30 * (1-_this.ward_coverage('fire'))); //look at wards
				_this.fire_damage_ticks_left--;
				if(_this.fire_damage_ticks_left > 0) {
					_this.fire_damage_timeout = setTimeout(do_fire_damage, 1000);
				}else{
					_this.fire_damage_timeout = clearTimeout(_this.fire_damage_timeout);
					_this.set('on_fire', false);
				}
			};
			this.fire_damage_timeout = setTimeout(do_fire_damage, 1000);
		}
		this.fire_damage_ticks_left = 5;
	},
	skynet_enabled: function() {
		this.set_starting_wards();
		this.thaw_timer = clearInterval(this.thaw_timer);
		this.thaw_timer = setInterval(this.thaw.bind(this), 1000);
		if(!this.ai_timeout) this.ai_timeout = setTimeout(this.ai_step.bind(this), 1000);				
	},
	skynet_disabled: function() {
		this.ai_timeout = clearTimeout(this.ai_timeout);
		var _this = this;
		setTimeout(function() { _this.set_default_values(); }, 2000);
		
		//everything fades out, don't have to clear any other timers because they will take care of themself in the background.
	},
});

models.RoundHistory = Backbone.Model.extend({
	initialize: function() {
		this.set({
			history: [],
		});
	},
	add_history: function(round_label, round_history) {
		var history = this.get('history');
		var  total_time = 0;
		if(round_label == 'offensive') {
			total_time = round_history[round_history.length-1].time_to_complete;
		}else if(round_label == 'olympic') {
			for(var i=0;i<20;i++) {
				total_time += round_history[i].time_to_complete;
			}
			total_time += round_history[round_history.length-1].time_to_complete;
		}else{
			for(var i=0;i<round_history.length;i++) {
				total_time += round_history[i].time_to_complete;
			}
		}
		
		history.push({ 
			on_leaderboard: round_history.length >= finch.game.minimum_leaderboard_round_length || round_label == 'offensive' || round_label == 'olympic',
			label: round_label,
			history: round_history,
			average_time: Math.floor(total_time / round_history.length),
			total_time: total_time,
			total_time_seconds: Math.floor(total_time/100)/10
		});
		
		this.set('history', history);
		this.trigger('change:history', this, history);
	},
	save_history: function(round_label, round_history, additional_attrs) {
		var _this = this;
		if(!additional_attrs)
			additional_attrs = {};
		
		var leaderboard_name = null;
		var leaderboard_country = null;		
		$.getJSON('/trainer-token/', function(result) {
			finch.game.statebag.tokens[1] = result.token;
		});
		var post_score_to_server = function() {
			$.ajax({
				url: '/trainer-save-history',
				type: 'POST',
				dataType: 'json',
				data: { tokens: JSON.stringify(finch.game.statebag.tokens), leaderboard_name: leaderboard_name, leaderboard_country: leaderboard_country, label: JSON.stringify(round_label), history: JSON.stringify(round_history), additional_attributes: JSON.stringify(additional_attrs) }
			}).done(function(result) {				
				var all_history = _this.get("history");
				var last_history = all_history[all_history.length-1];
				last_history.round_id = result.id;
				last_history.additional_attrs = additional_attrs;
				_this.set('history', all_history);								
			});
		};
				
		if(finch.game.round_length >= finch.game.minimum_leaderboard_round_length || finch.game.statebag.mode == 'offensive' || finch.game.statebag.mode == 'olympic') {
			var leaderboard_submit_view = new views.LeaderboardSubmit();
			leaderboard_submit_view.fadeIn();
			leaderboard_submit_view.on('save', function(name, country) {
				leaderboard_name = name;
				leaderboard_country = country;
				post_score_to_server();
			})
		}else{
			post_score_to_server();
		}				
	}
});

models.ObjectiveHistory = Backbone.Model.extend({	
	initialize: function() {
		this.set({
			history: [],
		});
	},
	clear: function() {
		this.set('history', []);
	},
	add_history: function(time_to_complete, element_queue, fumble, is_offensive) {		
		var history = this.get('history');
		var segment_marker = null;
		if(history.length == 0 && finch.game.statebag.mode == 'olympic') {
			segment_marker = finch.game.statebag.olympic_stage;
		}
		history.push({ 
			time_to_complete: time_to_complete,
			time_to_complete_seconds: Math.floor(time_to_complete/100)/10,
			element_queue: element_queue,
			fumble: fumble,
			is_offensive: is_offensive,
			segment_marker: segment_marker
		});		
		this.trigger('change:history', this, history);
	}
});

models.MessageBox = Backbone.Model.extend({
	initialize: function() {
		this.set({
			message: null
		});
	},
	set_message: function(message) {
		this.set('message', message);
		this.trigger('change:message');
	}
});

/** end backbone models **/

/** views **/
window.views = {};

views.Opponent = Backbone.View.extend({
	
	el: $('#opponent-slot'),
	initialize: function() {		
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.model.on('change:outer_ward', this.handle_ward_change.bind(this));
		this.model.on('change:inner_ward', this.handle_ward_change.bind(this));
		this.model.on('change:shield_active', this.handle_shield_change.bind(this));
		this.model.on('change:wall_active', this.handle_wall_change.bind(this));
		this.model.on('change:water_wall_active', this.handle_water_wall_change.bind(this));
		this.model.on('change:casting', this.handle_casting_change.bind(this));
		this.model.on('change:health', this.handle_health_change.bind(this));
		
		this.model.on('heal_cast', this.handle_heal_cast.bind(this));
		this.model.on('change:wet', this.handle_wet_change.bind(this));
		this.model.on('change:frozen_level', this.handle_frozen_level_change.bind(this));
		this.model.on('change:on_fire', this.handle_on_fire_change.bind(this));
	},
	handle_casting_change: function() {
		var casting = this.model.get('casting');		
		this.$el.find('.cast-bar .inner').stop().css({'width': '0%'});
		
		if(casting) {
			this.$el.find('.cast-bar .inner')				
				.animate({
					width: '100%'
				}, this.model.last_cast_time);
		}
	},
	handle_health_change: function() {
		var $health_bar = this.$el.find('.health-bar .inner').stop();
		$health_bar
			.animate({
				width: (this.model.get('health') / this.model.max_health)*100 + '%'
			}, 300);
	},
	handle_ward_change: function() {
		this.$el.find('.outer-ward > div').get(0).className = this.model.get('outer_ward');
		this.$el.find('.inner-ward > div').get(0).className = this.model.get('inner_ward');
	},
	handle_shield_change: function() {
		finch.game.views.battlefield_particle_effects.handle_shield_change(this.model.get('shield_active'));		
		if(this.model.get('shield_active'))
			this.$el.find('.shield').addClass('active');
		else
			this.$el.find('.shield').removeClass('active');
	},
	handle_heal_cast: function() {
		finch.game.views.battlefield_particle_effects.handle_heal_cast();
	},
	handle_wall_change: function() {
		finch.game.views.battlefield_particle_effects.handle_wall_change(this.model.get('wall_active'));		
		if(this.model.get('wall_active'))
			this.$el.find('.defensive-wall').addClass('active').show();
		else
			this.$el.find('.defensive-wall').fadeOut('fast', function() {
				$(this).removeClass('active').css('display', 'auto');
			});
	},
	handle_water_wall_change: function() {
		finch.game.views.battlefield_particle_effects.handle_water_wall_change(this.model.get('water_wall_active'));
	},
	handle_wet_change: function() {
		var wet = this.model.get('wet');
		finch.game.views.battlefield_particle_effects.handle_wet_change(wet);		
	},
	handle_frozen_level_change: function() {
		var frozen_level = this.model.get('frozen_level');
		this.$el.find('.frozen-indicator')
			.removeClass(function(idx, css) { return (css.match(/level-\S+/) || []).join(' '); } )
			.addClass('level-' + Math.floor(frozen_level));
	},
	handle_on_fire_change: function() {
		var on_fire = this.model.get('on_fire');
		finch.game.views.battlefield_particle_effects.handle_on_fire_change(on_fire);		
	},
	render: function() {
		this.$el.html($("#opponent-template").render({ model: this.model })).show();
		this.center();
		return this;
	},
	hide: function() {
		this.$el.fadeOut('fast');
	},
	center: function() {		
		this.$el.css({			
			left: ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth())/2 - this.$el.outerWidth()/2
		});
	}
});

views.RoundHistory = Backbone.View.extend({
		
	el: $('#round-history-slot'),
	
	initialize: function() {	
		this.model.on("change:history", this.handle_history_change.bind(this));	
		this.already_rendered = false;
	},
	
	handle_history_change: function(model, history) {
		this.render();		
	},
	
	render: function() {
		var history = this.model.get('history');
		var last_history = history[history.length-1];
		
		this.$el.find('#game-' + history.length).remove();
		var $round_history = $($("#round-history-template").render({ history: history[history.length-1], game_number: history.length }).trim());
		$round_history.find('.leaderboard-link').click(function() {			
			var leaderboard_mode = last_history.label;
			if(last_history.label == 'offensive') {
				switch(parseFloat(last_history.additional_attrs.spell_delay_modifier)) {
					case 2.0:
						leaderboard_mode = 'offensive-easy';
						break;
					case 1.25:
						leaderboard_mode = 'offensive-normal';
						break;
					case .75:
						leaderboard_mode = 'offensive-hard';
						break;
					default:
						leaderboard_mode = 'offensive-easy';
						
				}
			}
			finch.game.views.mode_selection.show_leaderboard(leaderboard_mode, last_history.round_id);
		});
		this.$el.prepend($round_history);
		this.$el.find('.game:first').hide().slideDown();
		this.$el.find('.game:not(:first)').find('.rows').slideUp('fast');
		this.$el.find('.game:first .header').on('click', function() {
			$(this).closest('.game').find('.rows').slideToggle();
		});
		
		return this;
	}
});

views.StatsOverview = Backbone.View.extend({
	el: $('#stats-overview-slot'),
	
	initialize: function() {	
		this.model.on("statistics_updated", this.handle_statistics_updated.bind(this));
	},
	
	handle_statistics_updated: function() {
		this.render();
	},
	
	render: function() {
		this.$el.html($("#stats-overview-template").render({ model: this.model }));
	}	
});

views.ObjectiveHistory = Backbone.View.extend({
	
	tagName: 'div',
	id: 'objective-history',
	
	initialize: function() {	
		this.model.on("change:history", this.handle_history_change.bind(this));	
		this.already_rendered = false;
		finch.game.views.global.on('smart_resize', this.center.bind(this));
	},
	
	handle_history_change: function(model, history) {
		if(finch.game.statebag.mode !== 'offensive' && !(finch.game.statebag.mode == 'olympic' && finch.game.statebag.olympic_stage == 'offensive'))
			this.render();		
	},
	
	transition_to_round_history: function(callback) {
		var $target = finch.game.views.round_history.$el;
		var _this = this;
		this.$el.animate({
			top: $target.position().top,
			left: $target.position().left,
			opacity: 0,
		}, function() {
			if(callback) callback();
			_this.already_rendered = false;
			$(this).hide();
		});		
	},
	
	hide: function() {
		this.$el.hide();
	},
	
	render: function() {				
		var history = this.model.get('history');		
		this.$el.html($("#history-template").render({ history: history.slice(0).reverse() }));
		this.$el.show().find(".history:first").hide().fadeIn();	
		
		//first time rendering position it in the middle of the playing field.
		if(!this.already_rendered) {
			this.already_rendered = true;		
			var $battlefield = $('#battlefield');
			$battlefield.append(this.$el);			
			this.$el.css({ opacity: 100 });
			this.$el.show();
			this.center();
		}
		
		if(history.length >= 5) {
			this.$el.find(".history-shadow").show();
		}else{
			this.$el.find(".history-shadow").hide();
		}		
		
		return this;		
	},
	
	center: function() {
		//position it in the middle of the battlefield by default, it can get moved though
		var $queued_elements = finch.game.views.queued_elements.$el;
		this.$el.css({
			top:  $queued_elements.position().top + $queued_elements.outerHeight() + 10,
			left: ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth())/2 - this.$el.outerWidth()/2
		});
	}
	
});

views.Global = Backbone.View.extend({
	el: $('body'),
	events: {
		'keydown': 'handle_keydown',
		'keyup': 'handle_keyup',
		'mousedown': 'handle_mousedown',
		'mouseup': 'handle_mouseup',
	},
	initialize: function() {					
		$(window).resize(this.handle_resize.bind(this));
		document.oncontextmenu = this.handle_oncontextmenu.bind(this);
	},
	handle_keydown: function(evt) {
		if(finch.game.paused) return;
		
		var key = String.fromCharCode(evt.which).toUpperCase();
		if(finch.game.controls.elements)
			finch.game.controls.elements.handle_keydown(key);				
	},	
	handle_keyup: function(evt) {
		var key = String.fromCharCode(evt.which).toUpperCase();
		if(finch.game.controls.elements)
			finch.game.controls.elements.handle_keyup(key);
	},
	handle_mousedown: function(evt) {
		switch(evt.which) {
			case 1:
				this.trigger('left_mouse_press');
				break;
			case 3:
				evt.preventDefault();				
				this.trigger('right_mouse_press');
				break;
		}
	},
	handle_mouseup: function(evt) {
		switch(evt.which) {
			case 1:
				this.trigger('left_mouse_release');
				break;
			case 3:
				evt.preventDefault();				
				this.trigger('right_mouse_release');
				break;
		}
	},
	handle_oncontextmenu: function(evt) {
		if(!finch.game.paused)
			evt.preventDefault();		
	},
	handle_resize: function() {
		this.trigger('smart_resize');
	}
});

views.BattlefieldLineEffects = Backbone.View.extend({
	images: [],
	el: $('#battlefield-line-effects'),
	render_timer: null,
	initialize: function() {
		this.images['rock'] = new Image();
		this.images['rock'].src = '/static/images/finch/particle-rock.png';
		
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.center();
		this.canvas = this.$el.get(0);
		this.context = this.canvas.getContext('2d');
		this.beam_cnt = 0;		
		finch.game.controls.elements.on('cast_start', this.handle_cast_start.bind(this));
		finch.game.controls.elements.on('cast_stop', this.handle_cast_stop.bind(this));		
		
	},
	handle_cast_start: function() {
		var combo_parser = finch.game.controls.elements.casting_combo_parser;
		var elements = combo_parser.get('elements');
		var _this = this;	
		
		switch(combo_parser.get_spell_type()) {
			case 'BEAM':
				var type = 'life';
				if($.inArray('arcane', elements) !== -1)
					type = 'arcane';
				if($.inArray('fire', elements) !== -1)
					type = 'fire';
				if($.inArray('cold', elements) !== -1)
					type = 'cold';
				if($.inArray('water', elements) !== -1)
					type = 'water';
				
				clearInterval(this.render_timer);
				this.render_timer = setInterval(function() {
					_this.draw_beam(type);
				}, 100);
				break;
			case 'LIGHTNING':
				var lightning_type = 'lightning';
				
				if(combo_parser.has_element('life')) {
					lightning_type = 'life';
				}else if(combo_parser.has_element('cold')) {
					lightning_type = 'cold';
				}else if(combo_parser.has_element('fire')) {
					lightning_type = 'fire';
				}else if(combo_parser.has_element('arcane')) {
					lightning_type = 'arcane';
				}
				clearInterval(this.render_timer);
				this.render_timer = setInterval(function() {					
					_this.draw_lightning(lightning_type);
				}, 300);
				this.draw_lightning(lightning_type);
				break;
		}
	},
	handle_cast_stop: function() {
		clearInterval(this.render_timer);
		this.clear_canvas();
	},
	queue_canvas_clear: function() {
		this.clear_canvas();
	},
	clear_canvas: function() {
		//this should happen automatically, maybe i should make a draw queue or something and clear before the draw.
		this.context.save();
		this.context.setTransform(1, 0, 0, 1, 0, 0);
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.context.restore();
	},
	// :( I suck at opengl, this is obviously a bad way to do this
	draw_rock_at: function(x, y, height, width) {
		this.context.drawImage(this.images['rock'], x, y, height, width);
	},
	draw_beam: function(type) {		
		this.clear_canvas();
		
		var origin = {
			x: this.$el.get(0).width / 2,
			y: this.$el.get(0).height			
		};
		
		var end = {
			x: this.$el.get(0).width / 2,
			y: finch.game.opponent.get("wall_active") || finch.game.opponent.get("shield_active") ? 260 : 180
		};
		
		var draw_multipoint_line = function(points, context) {
			context.beginPath();
			for(i=0;i<points.length;i++) {
				if(i==0) {
					context.moveTo(points[i].x, points[i].y);
				}else{
					context.lineTo(points[i].x, points[i].y);
				}
			}
			context.stroke();
		}
		this.context.shadowBlur=30;
		this.context.shadowColor='#e22d2a';
		this.context.strokeStyle = '#e22d2a';
		
		switch(type) {
			case 'life':
				this.context.shadowColor='#4aaa16';
				this.context.strokeStyle = '#4aaa16';
				break;
			case 'water':					
				this.context.shadowColor='#005dac';
				this.context.strokeStyle = '#338ECF';
				break;
			case 'fire':					
				this.context.shadowColor='#cf5f01';
				this.context.strokeStyle = '#cf5f01';
				break;
			case 'cold':					
				this.context.shadowColor='#dafcfc';
				this.context.strokeStyle = '#dafcfc';
				break;
		}
		
		this.beam_cnt++;
		this.context.lineWidth = (this.beam_cnt % 6 > 2 ? 1 : -1) * this.beam_cnt % 3 + 10;		
		draw_multipoint_line([origin, end], this.context);
	},
	draw_lightning: function(type) {
		if(!type)
			type = 'default';
		
		this.clear_canvas();
		
		var origin = {
			x: this.$el.get(0).width / 2,
			y: this.$el.get(0).height			
		};
		
		var end = {
			x: this.$el.get(0).width / 2,
			y: finch.game.opponent.get("wall_active") || finch.game.opponent.get("water_wall_active") ? 260 : 180
		};
		
		var variable_points = [];
		var twining_points = [];
		var twining_points2 = [];
		var total_points = 7;
		var point_offset = {
			x: (end.x - origin.x) / total_points,
			y: (end.y - origin.y) / total_points
		};
		for(i=1;i<total_points-1;i++) {
			var variable_point = {
				x: i*point_offset.x+origin.x + (Math.random() * i*15) - i*15/2,
				y: i*point_offset.y+origin.y + (Math.random() * i*15) - i*15/2
			}
			twining_points.push({
				x: variable_point.x + (Math.random() * (total_points+1-i)*8) - (total_points+1-i)*8/2,
				y: variable_point.y + (Math.random() * (total_points+1-i)*8) - (total_points+1-i)*8/2,
			})
			twining_points2.push({
				x: variable_point.x + (Math.random() * (total_points+1-i)*8) - (total_points+1-i)*8/2,
				y: variable_point.y + (Math.random() * (total_points+1-i)*8) - (total_points+1-i)*8/2,
			})
			variable_points.push(variable_point);
		}
		
		var draw_multipoint_line = function(points, context) {
			context.beginPath();
			for(i=0;i<points.length;i++) {
				if(i==0) {
					context.moveTo(points[i].x, points[i].y);
				}else{
					context.lineTo(points[i].x, points[i].y);
				}
			}
			context.stroke();
		}
		
		var secondary_bolt_color = '#E9C1FC';
		var shadow_color = "#FF00FF";
		switch(type) {
			case 'fire':
				secondary_bolt_color = '#cf5f01';
				shadow_color = '#FF3333';
				break;
			case 'cold':
				secondary_bolt_color = '#dafcfc';
				shadow_color = '#3333FF';
				break;
			case 'arcane':
				secondary_bolt_color = '#8e1616';
				shadow_color = '#AA0000';
				break;
			case 'life':
				secondary_bolt_color = '#4aaa16';
				shadow_color = '#33FF33';
		}
		
		this.context.shadowBlur=10;
		this.context.shadowColor=shadow_color;
		this.context.strokeStyle = secondary_bolt_color;
		this.context.lineWidth = 2;
		draw_multipoint_line([].concat.apply([], [[origin], twining_points, [end]]), this.context);
		draw_multipoint_line([].concat.apply([], [[origin], twining_points2, [end]]), this.context);
				
		this.context.shadowColor=shadow_color;
		this.context.strokeStyle = '#E9C1FC';
		this.context.lineWidth = 4;
		draw_multipoint_line([].concat.apply([], [[origin], variable_points, [end]]), this.context);
	},
	show: function() {
		this.$el.show();
	},	
	hide: function() {
		this.$el.hide();
	},
	center: function(animate) {	
		var height = $('#battlefield').innerHeight();
		var width = ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth());
				
		this.$el.css({
			height: height,
			width: width
		});		
		
		this.$el.get(0).width = width;
		this.$el.get(0).height = height;
	}
});

views.BattlefieldParticleEffects = Backbone.View.extend({
	el: $('#battlefield-particle-effects'),	
	proton: null,
	renderer: null,	
	emitters_queued_to_cancel: [],
	emitters_affected_by_shield: [],
	wet_status_emitters: [],
	water_wall_emiters: [],
	fire_status_emitter: null,
	heal_status_emitter: null,
	initialize: function() {
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.center();
			
		var canvas = this.$el.get(0);		
		this.proton = new Proton();
		var renderer =  new Proton.Renderer('webgl', this.proton, canvas);		
		renderer.blendFunc("SRC_ALPHA_SATURATE", "ONE");	

		renderer.start();
		this.renderer = renderer;
		
		requestAnimationFrame(this.render_loop.bind(this));
		finch.game.controls.elements.on('cast_start', this.handle_cast_start.bind(this));
		finch.game.controls.elements.on('cast_stop', this.handle_cast_stop.bind(this));
				
		this.wet_status_emitters = this.get_wet_status_emitters();
		for(i=0;i<this.wet_status_emitters.length;i++){
			this.proton.addEmitter(this.wet_status_emitters[i]);
		}
		
		this.water_wall_emitters = this.get_water_wall_emitters();
		for(i=0;i<this.water_wall_emitters.length;i++){
			this.proton.addEmitter(this.water_wall_emitters[i]);
		}
		
		this.fire_status_emitter = this.get_fire_status_emitter();
		this.proton.addEmitter(this.fire_status_emitter);
		
		this.heal_status_emitter = this.get_heal_status_emitter();
		this.proton.addEmitter(this.heal_status_emitter);
		
		this.shield_repulsion_behavior = new Proton.Repulsion({
			x: this.$el.get(0).width / 2,
			y: 250,
		}, 10, 90);
		this.wall_repulsion_behavior = new Proton.Repulsion({
			x: this.$el.get(0).width / 2,
			y: 300,
		}, 10, 90);				
	},
	cancel_on_stopcast: function(emitter) {
		this.emitters_queued_to_cancel.push(emitter);
	},
	handle_wet_change: function(wet) {
		if(wet) {
			$.each(this.wet_status_emitters, function(idx, emitter) { emitter.emit(); });
		}else{
			$.each(this.wet_status_emitters, function(idx, emitter) { emitter.stopEmit(); });
		}		
	},
	handle_on_fire_change: function(on_fire) {
		if(on_fire) {
			this.fire_status_emitter.emit();
		}else{
			this.fire_status_emitter.stopEmit();
		}
	},
	handle_heal_cast: function() {
		this.heal_status_emitter.emit(1);
	},
	handle_water_wall_change: function(wall_active) {
		if(wall_active) {
			$.each(this.water_wall_emitters, function(idx, emitter) { emitter.emit(); })
		}else{
			$.each(this.water_wall_emitters, function(idx, emitter) { emitter.stopEmit(); })
		}
	},
	handle_wall_change: function(wall_active) {
		for(i=0;i<this.emitters_affected_by_shield.length;/*same group of emitters*/i++) {
			if(!this.emitters_affected_by_shield[i].alive)
				continue;
			
			try {
				if(wall_active) {
					this.emitters_affected_by_shield[i].addBehaviour(this.wall_repulsion_behavior);
					for(j=0;j<this.emitters_affected_by_shield[i].particles.length;j++) {
						this.emitters_affected_by_shield[i].particles[j].addBehaviour(this.wall_repulsion_behavior);
					}
				}else{
					this.emitters_affected_by_shield[i].removeBehaviour(this.wall_repulsion_behavior);
					for(j=0;j<this.emitters_affected_by_shield[i].particles.length;j++) {
						this.emitters_affected_by_shield[i].particles[j].removeBehaviour(this.wall_repulsion_behavior);
					}
				}
			}catch(exc) {
				console.log(exc);
				//who cares, this is because some emitters are stale, they should be removed but i don't care if this gets hit
			}
		}
	},
	handle_shield_change: function(shield_active) {		
		for(i=0;i<this.emitters_affected_by_shield.length;i++) {
			if(!this.emitters_affected_by_shield[i].alive)
				continue;
			
			try {
				if(shield_active) {
					this.emitters_affected_by_shield[i].addBehaviour(this.shield_repulsion_behavior);
					for(j=0;j<this.emitters_affected_by_shield[i].particles.length;j++) {
						this.emitters_affected_by_shield[i].particles[j].addBehaviour(this.shield_repulsion_behavior);
					}
				}else{
					this.emitters_affected_by_shield[i].removeBehaviour(this.shield_repulsion_behavior);
					for(j=0;j<this.emitters_affected_by_shield[i].particles.length;j++) {
						this.emitters_affected_by_shield[i].particles[j].removeBehaviour(this.shield_repulsion_behavior);
					}
				}
			}catch(exc) {
				//who cares, this is because some emitters are stale, they should be removed but i don't care if this gets hit
			}
		}
	},
	handle_cast_start: function() {
		var combo_parser = finch.game.controls.elements.casting_combo_parser;
		var elements = combo_parser.get('elements');
			
		switch(combo_parser.get_spell_type()) {
			case 'SPRAY':
				var emitter = null;
				if($.inArray('fire', elements) !== -1) {
					emitter = this.get_fire_emitter();
					
				}else if($.inArray('cold', elements) !== -1) {
					emitter = this.get_cold_emitter();					
				}else if($.inArray('water', elements) !== -1) {
					emitter = this.get_water_emitter();					
				}
				
				emitter.emit();
				emitter.alive = true;
				if(finch.game.opponent.get('shield_active'))
					emitter.addBehaviour(this.shield_repulsion_behavior);
				if(finch.game.opponent.get('wall_active'))
					emitter.addBehaviour(this.wall_repulsion_behavior);
				this.proton.addEmitter(emitter);
				this.cancel_on_stopcast(emitter);
				this.emitters_affected_by_shield.push(emitter);
				break;
			case 'BEAM':
				var type = 'life';
				if($.inArray('arcane', elements) !== -1)
					type = 'arcane';
				var emitter = this.get_beam_endpoint_emitter(type /* type is not yet used */);
				this.proton.addEmitter(emitter);				
				emitter.p.y = -250; 
				var render_spark = function() {
					if(emitter.alive) {
						if(finch.game.opponent.get("wall_active") || finch.game.opponent.get("shield_active")) {
							emitter.p.y = -170;							
						}else{
							emitter.p.y = -250;
						}
											
						emitter.timeout = setTimeout(render_spark, 300);
					}
				};
				emitter.alive = true;
				render_spark();
				emitter.emit();
				this.cancel_on_stopcast(emitter);
				break;
			case 'LIGHTNING':
				var emitter = this.get_lightning_endpoint_emitter();
				var render_spark = function() {
					if(emitter.alive) {
						if(finch.game.opponent.get("wall_active") || finch.game.opponent.get("water_wall_active")) {
							emitter.p.y = -150;							
						}else{
							emitter.p.y = -230;
						}
							
						emitter.emit('once');					
						emitter.timeout = setTimeout(render_spark, 300);
					}
				};
				emitter.alive = true;
				render_spark();
				this.proton.addEmitter(emitter);
				if(finch.game.opponent.get("wall_active") || finch.game.opponent.get("water_wall_active")) {
					emitter.p.y = -150;							
				}else{
					emitter.p.y = -230;
				}
				this.cancel_on_stopcast(emitter);
				break;
		}
	},
	handle_cast_stop: function() {
		var _this = this;
		for(i=0;i<this.emitters_queued_to_cancel.length;i++) {
			this.emitters_queued_to_cancel[i].stopEmit();
			this.emitters_queued_to_cancel[i].alive = false;			
		}
		
		var combo_parser = finch.game.controls.elements.casting_combo_parser;
		
		if(!combo_parser) {
			//casting already stopped or we have a pretty big error
			return;
		}
			
		var elements = combo_parser.get('elements');
		var collision_emitter_bounds = null;
		var collision_callback = null;
		
		var cast_power = finch.game.controls.elements.get('casting_power');
		var emitter_movespeed = Math.max(1.5*(Math.log(cast_power / 10) * Math.log(cast_power / 10)) / 5.3 /* log(10) * log(10) */, .2);
		var emitter_life = 350 * emitter_movespeed;
		
		switch(combo_parser.get_spell_type()) {
			case 'ICE_SHARDS':
				var draws = 0;
				var shard_collision_callback = (function(emitter) {					
					finch.game.controls.elements.spell_landed(combo_parser, this.$el.get(0).height + emitter.p.y, cast_power);
				}).bind(this);
				
				var shard_type = 'ice';
				if(combo_parser.has_element('life')) {
					shard_type = 'life';
				}else if(combo_parser.has_element('arcane')) {
					shard_type = 'arcane';
				}
				
				for(i=0;i<3;i++) {
					var emitter = this.get_shard_emitter(emitter_movespeed, emitter_life, shard_collision_callback, shard_type);					
					emitter.emit(1,2);					
					this.proton.addEmitter(emitter);
				}
				break;
			case 'ROCK_PROJECTILE':
				var emitter = null;
				var explosion_type = 'fire';
				
				if($.inArray('fire', elements) !== -1) {
					emitter = this.get_fireball_emitter();					
				}else if($.inArray('cold', elements) !== -1) {
					emitter = this.get_frostball_emitter();
					explosion_type = 'cold';
				}else if($.inArray('water', elements) !== -1) {
					emitter = this.get_waterball_emitter();
					explosion_type = 'water';
				}else if($.inArray('arcane', elements) !== -1) {
					emitter = this.get_deathball_emitter();
					explosion_type = 'arcane';
				}else if($.inArray('life', elements) !== -1) {
					emitter = this.get_lifeball_emitter();
					explosion_type = 'life';
				}else{
					emitter = this.get_rockball_emitter();	
					explosion_type = 'rock';
				}
								
				collision_emitter = emitter;				
				emitter.emit();				
				collision_emitter_bounds = -300;
				
				this.proton.addEmitter(emitter);				
				collision_callback = (function(emitter) { 
					this.render_explosion_at('center', this.$el.get(0).height + emitter.p.y, explosion_type);					
					finch.game.controls.elements.spell_landed(combo_parser, this.$el.get(0).height + emitter.p.y, cast_power);
				}).bind(this);
				
				var show_rock = function() {
					finch.game.views.battlefield_line_effects.queue_canvas_clear();
					
					if(emitter.emitTotalTimes != -1) {
						requestAnimationFrame(show_rock);
						finch.game.views.battlefield_line_effects.draw_rock_at(_this.$el.get(0).width/2-18, _this.$el.get(0).height + emitter.p.y-15, 36, 36);
					}
				}
				show_rock();
				break;
		}
				
		if(collision_emitter_bounds && emitter_movespeed) {
			var last_timestamp = null
			var first_timestamp = null;
			var move_emitter = function(timestamp) {
					if(!first_timestamp) first_timestamp = timestamp;					
					if(last_timestamp) {										
						emitter.p.y = emitter.p.y - (timestamp - last_timestamp)*emitter_movespeed;					
					}
					collision_emitter_bounds = -300; /* i think this is relative from where the emitter starts */
					if(finch.game.opponent.get("wall_active"))
						collision_emitter_bounds = -200;
					
					if(emitter.p.y <= collision_emitter_bounds || timestamp - first_timestamp > emitter_life) {
						emitter.stopEmit();						
						if(collision_callback) {
							collision_callback(emitter);
						}
						return;
					}					
					last_timestamp = timestamp;
				
				requestAnimationFrame(move_emitter);
			}
			move_emitter();
		}
	},
	show: function() {
		this.$el.show();
		var gl = this.renderer.renderer.gl;
		gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)
	},	
	hide: function() {
		this.$el.hide();
	},
	render_loop: function() {
		requestAnimationFrame(this.render_loop.bind(this));
		this.proton.update();
	},
	render_explosion_at: function(x, y, type) {
		if(x == 'center') {
			x = this.$el.get(0).width / 2;
		}		
		var explosion_type = 'ragged';
		if(type == 'life' || type == 'arcane')
			explosion_type = 'uniform';
		
		var emitter = new Proton.Emitter();
		if(type == 'shard') {
			emitter.rate = new Proton.Rate(new Proton.Span(10, 25), .2);
		}else{
			emitter.rate = new Proton.Rate(new Proton.Span(60, 75), .2);
		}
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(x, y+50, 1)));		
		emitter.addInitialize(new Proton.Life((explosion_type == 'ragged' ? .2 : .3), (explosion_type == 'ragged' ? 1 : .3)));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Radius(30));
		emitter.addInitialize(new Proton.V(new Proton.Span((explosion_type == 'ragged' ? 2 : 4), 4), new Proton.Span(0, 360), 'polar'));
		if(explosion_type == 'ragged')
			emitter.addBehaviour(new Proton.Alpha(.75, .3));
		if(type == 'water') {
			emitter.addBehaviour(new Proton.Color('#005dac', '#FFFFEE'));
		}else if(type == 'cold' || type == 'shard'){
			emitter.addBehaviour(new Proton.Color('#FFFFEF', '#FFFFEE'));
		}else if(type == 'arcane'){
			emitter.addBehaviour(new Proton.Color('#8e1616', '#FFFFEE'));
		}else if(type == 'life'){
			emitter.addBehaviour(new Proton.Color('#4aaa16', '#FFFFEE'));
		}else if(type == 'rock'){
			emitter.addBehaviour(new Proton.Color('#ac8637', '#333'));			
		}else{
			emitter.addBehaviour(new Proton.Color('#cf5f01', '#fff334'));
		}
		emitter.addBehaviour(new Proton.Scale(Proton.getSpan((explosion_type == 'ragged' ? .3 : 3), 3), 0));
		
		emitter.emit('once');
		
		this.proton.addEmitter(emitter);		
	},
	get_fire_status_emitter: function() {
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(1, 2), .1);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, 170, 25)));		
		emitter.addInitialize(new Proton.Life(1, 4));
		emitter.addInitialize(new Proton.V(new Proton.Span(.5, 1), new Proton.Span(0, 50, true), 'polar'));		
		emitter.addBehaviour(new Proton.Color('#cf5f01', '#fff334'));		
		emitter.addBehaviour(new Proton.Scale(.3, 0));	
		emitter.addBehaviour(new Proton.Gravity(.2));
		emitter.addBehaviour(new Proton.Alpha(1, .5));
		
		return emitter;
	},
	get_wet_status_emitters: function() {		
		var right_emitter = new Proton.Emitter();
		right_emitter.rate = new Proton.Rate(new Proton.Span(5, 6), 1);
		right_emitter.addInitialize(new Proton.Mass(1));
		right_emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/droplet-particle.png'));
		right_emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2 + 20, 150, 1)));		
		right_emitter.addInitialize(new Proton.Life(.5, 1));
		right_emitter.addInitialize(new Proton.V(new Proton.Span(1, 1.5), new Proton.Span(80, 30, true), 'polar'));		
		right_emitter.addBehaviour(new Proton.Color('#005dac', '#005dac'));		
		right_emitter.addBehaviour(new Proton.Scale(.5, 0));
		right_emitter.addBehaviour(new Proton.Gravity(4));
		right_emitter.addBehaviour(new Proton.Rotate());
		
		var left_emitter = new Proton.Emitter();
		left_emitter.rate = new Proton.Rate(new Proton.Span(5, 6), 1);
		left_emitter.addInitialize(new Proton.Mass(1));
		left_emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/droplet-particle.png'));
		left_emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2 - 20, 150, 1)));		
		left_emitter.addInitialize(new Proton.Life(.5, 1));
		left_emitter.addInitialize(new Proton.V(new Proton.Span(1, 1.5), new Proton.Span(280, 30, true), 'polar'));		
		left_emitter.addBehaviour(new Proton.Color('#005dac', '#005dac'));		
		left_emitter.addBehaviour(new Proton.Scale(.5, 0));
		left_emitter.addBehaviour(new Proton.Gravity(4));
		left_emitter.addBehaviour(new Proton.Rotate());
		
		return [right_emitter, left_emitter];
	},
	get_water_wall_emitters: function() {
		var emitters = [];
		for(i=0;i<3;i++) {
			var emitter = new Proton.Emitter();
			emitter.rate = new Proton.Rate(new Proton.Span(5, 10), .1);
			emitter.addInitialize(new Proton.Mass(1));
			emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
			emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, 220, 1)));
			emitter.addInitialize(new Proton.Life(.75, 1.25));
			emitter.addInitialize(new Proton.V(new Proton.Span(.7, 1), new Proton.Span(180, 35, true), 'polar'));
			emitter.addBehaviour(new Proton.Color('#005dac', '#ffffee'));		
			emitter.addBehaviour(new Proton.Scale(.5, 0));
			emitter.addBehaviour(new Proton.Gravity(-1.5));
			
			emitters.push(emitter);
		}
		
		emitters[0].p.x -= 40;
		emitters[1].p.y += 10;
		emitters[2].p.x += 40;
		
		return emitters;
	},
	get_heal_status_emitter: function() {
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(1, 2), .24);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/plus-particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, 170, 5)));		
		emitter.addInitialize(new Proton.Life(2, 4));
		emitter.addInitialize(new Proton.V(new Proton.Span(.5, 1), new Proton.Span(0, 30, true), 'polar'));		
		emitter.addBehaviour(new Proton.Color('#99ea56', '#99ea56'));		
		emitter.addBehaviour(new Proton.Scale(1, 0));
		
		return emitter;
	},
	get_beam_endpoint_emitter: function(type) {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(2, 3), new Proton.Span(180, 60, true), 'polar'));		 
		emitter.addBehaviour(new Proton.Color('#FFFFFF', '#FFFFFF'));
		emitter.addBehaviour(new Proton.Scale(.4, 0));
		
		return emitter;
	},
	get_lightning_endpoint_emitter: function(type) {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(40, 60), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.3, 1));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 2), new Proton.Span(0, 100, true), 'polar'));		
		emitter.addBehaviour(new Proton.Color('#f2c6f9', '#FFFFFF'));		
		emitter.addBehaviour(new Proton.Scale(.2, 0));
		emitter.addBehaviour(new Proton.Gravity(4));
		
		return emitter;
	},
	get_rockball_emitter: function() {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 2), new Proton.Span(180, 18, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#ac8637', '#333'));
		emitter.addBehaviour(new Proton.Scale(1, .2));		
		
		return emitter;
	},
	get_fireball_emitter: function() {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 2), new Proton.Span(180, 18, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#cf5f01', '#f7fe00'));
		emitter.addBehaviour(new Proton.Scale(1, .2));		
		
		return emitter;
	},
	get_lifeball_emitter: function() {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 2), new Proton.Span(180, 35, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#4aaa16', '#FFFFEE'));
		emitter.addBehaviour(new Proton.Scale(1, .2));
				
		return emitter;
	},
	get_frostball_emitter: function() {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 2), new Proton.Span(180, 18, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#dafcfc', '#FFFFEE'));
		emitter.addBehaviour(new Proton.Scale(1, .2));		
		
		return emitter;
	},
	get_deathball_emitter: function() {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 2), new Proton.Span(180, 18, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#8e1616', '#FFFFEE'));
		emitter.addBehaviour(new Proton.Scale(1, .2));		
		
		return emitter;
	},
	get_waterball_emitter: function() {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(-2, -3), new Proton.Span(180, 35, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#005dac', '#FFFFEE'));
		emitter.addBehaviour(new Proton.Scale(1, .2));
		emitter.addBehaviour(new Proton.Alpha(1, .2));
		
		return emitter;
	},
	get_shard_emitter: function(speed, life, collision_callback, type) {
		if(!type)
			type = 'ice';
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 10), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 0)));
		emitter.addInitialize(new Proton.Life(1, 1));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 3), new Proton.Span(180, .1, true), 'polar'));
		var shard_color = '#FFFFEF';
		if(type == 'life') {
			shard_color = '#4aaa16';
		}else if(type == 'arcane'){
			shard_color = '#8e1616';
		}
		
		emitter.addBehaviour(new Proton.Color(shard_color, '#FFFFEE'));
		emitter.addBehaviour(new Proton.Scale(.4, .2));
		emitter.addBehaviour(new Proton.Alpha(1, 0));		
		
		var drift = (Math.floor(Math.random()*8)+1) - 4;
		var last_timestamp = null
		var start = null;
		var _this = this;
		var move_emitter = function(timestamp) {
			if(!start && timestamp) start = timestamp;
			var collision_point = -300;
			if(finch.game.opponent.get("wall_active")) {
				collision_point = -200;
			}			
			if(emitter.p.y < collision_point || (timestamp && (timestamp - start > life))) {
				emitter.stopEmit();
				collision_callback(emitter);
				_this.render_explosion_at(_this.$el.get(0).width/2 + emitter.p.x, _this.$el.get(0).height + emitter.p.y, 'shard');
				return;
			}
			
			if(last_timestamp) {
				emitter.p.y = emitter.p.y - (timestamp - last_timestamp) * speed;	
				emitter.p.x = emitter.p.x + drift;
			}
			requestAnimationFrame(move_emitter);
			last_timestamp = timestamp;
		}
		move_emitter();
		
		return emitter;
	},
	get_fire_emitter: function() {
		emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(25, 85), .15);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 10)));
		emitter.addInitialize(new Proton.Life(1, 3));
		emitter.addInitialize(new Proton.V(new Proton.Span(3, 4), new Proton.Span(0, 18, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#cf5f01', '#f7fe00'));

		emitter.addBehaviour(new Proton.Scale(2, .1));
		emitter.addBehaviour(new Proton.Alpha(1, 0));
		
		return emitter;
	},
	get_cold_emitter: function() {
		emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(25, 55), .1);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 10)));
		emitter.addInitialize(new Proton.Life(2, 2));
		emitter.addInitialize(new Proton.V(new Proton.Span(3.8, 4), new Proton.Span(0, 25, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#dafcfc', '#FFFFFF'));

		emitter.addBehaviour(new Proton.Scale(2, 0));
		emitter.addBehaviour(new Proton.Alpha(1, .3));
		
		return emitter;
	},
	get_water_emitter: function() {
		emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(60, 80), .1);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));		
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 10)));
		emitter.addInitialize(new Proton.Life(1, 3));
		emitter.addInitialize(new Proton.V(new Proton.Span(5, 6), new Proton.Span(0, 18, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#005dac', '#9aecfb'));
		emitter.addBehaviour(new Proton.Gravity(4));
		
		emitter.addBehaviour(new Proton.Scale(1, .4));
		emitter.addBehaviour(new Proton.Alpha(.5, .25));
		
		return emitter;
	},
	center: function(animate) {	
		var height = $('#battlefield').innerHeight();
		var width = ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth());
				
		this.$el.css({
			height: height,
			width: width
		});		
		
		this.$el.get(0).width = width;
		this.$el.get(0).height = height;
	}
});

views.ModeSelection = Backbone.View.extend({
	view_stack: [],
	el: $('#mode-selection'),
	events: {
		'click .dequeue-mode': 'show_dequeue_instructions',
		'click .queue-mode': 'show_queue_instructions',
		'click .offensive-mode': 'show_offensive_instructions',
		'click .leaderboard-mode': 'show_leaderboards',
		'click .olympic-mode': 'show_olympic_mode_instructions',
	},
	
	initialize: function() {
		$('#cancel-game').click(this.cancel_game.bind(this));
		this.countdown_timer = null;
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.view_stack.push(this.$el);
	},
		
	cancel_game: function() {
		finch.game.pause();		
		if(finch.game.controls.elements) {
			finch.game.controls.elements.clear_queued_elements();
			finch.game.controls.elements.show_cast_bar = false;
		}
		finch.game.views.mode_selection.show();	
		if(finch.game.objective_history) {
			finch.game.objective_history.clear();
			finch.game.views.objective_history.hide();
		}
		if(finch.game.views.queued_elements)
			finch.game.views.queued_elements.hide()
		if(finch.game.views.queued_elements_helper)
			finch.game.views.queued_elements_helper.hide()
		if(finch.game.views.opponent)
			finch.game.views.opponent.hide();
		if(finch.game.views.battlefield_particle_effects)
			finch.game.views.battlefield_particle_effects.hide();
		if(finch.game.views.battlefield_line_effects)
			finch.game.views.battlefield_line_effects.hide();
		
		this.countdown_timer = clearTimeout(this.countdown_timer);
		$('.countdown').remove();
	},
	
	show_dequeue_instructions: function() {
		var _this = this;
		var $instructions =$($('#dequeue-mode-instructions').render().trim());
		
		$('#battlefield').append($instructions);
		this.push_window($instructions);
		
		$instructions.find('.start-button').click(function() {			
			_this.start_dequeue_game();			
		});
		
		var check_round_length = function() {
			if(finch.game.round_length < 10) {
				$instructions.find(".leaderboard-warning").fadeIn().effect('highlight');
			}else{
				$instructions.find(".leaderboard-warning").fadeOut();
			}
		};
		
		$('#dequeue-round-length', $instructions).val(finch.game.round_length);
		$('#dequeue-round-length').on('change', function() {
			finch.game.round_length = parseInt($(this).val());
			check_round_length();
		});
		check_round_length();
	},
	
	show_queue_instructions: function() {
		var _this = this;
		var $instructions =$($('#queue-mode-instructions').render().trim());
		
		$('#battlefield').append($instructions);
		this.push_window($instructions);
		
		$instructions.find('.start-button').click(function() {			
			_this.start_queue_game();			
		});
		
		var check_round_length = function() {
			if(finch.game.round_length < 10) {
				$instructions.find(".leaderboard-warning").fadeIn().effect('highlight');
			}else{
				$instructions.find(".leaderboard-warning").fadeOut();
			}
		};
		
		$('#queue-round-length', $instructions).val(finch.game.round_length);
		$('#queue-round-length').on('change', function() {
			finch.game.round_length = parseInt($(this).val());
			check_round_length();
		});
		check_round_length();
	},
	
	show_offensive_instructions: function() {
		var _this = this;
		var $instructions =$($('#offensive-mode-instructions').render({ webgl_supported: !!finch.game.views.battlefield_particle_effects }).trim());
		
		$('#battlefield').append($instructions);
		this.push_window($instructions);
		
		$instructions.find('.start-button').click(function() {			
			_this.start_offensive_game();			
		});
		
		var $animated_elements = $instructions.find("div[class*='anim-']");
		$animated_elements.hide();
		var cnt = 0;
		var animation_loop = function() {
			if(cnt==0)
				$animated_elements.hide();
			
			$($animated_elements[cnt]).fadeIn(1000, function() {				
				cnt++;
				if(cnt >= $animated_elements.length) {
					cnt=0;					
					setTimeout(animation_loop, 3000);
				}else{
					animation_loop();
				}
			})
		};
		animation_loop();
	},
	
	show_olympic_mode_instructions: function() {
		var _this = this;
		var $instructions =$($('#olympic-mode-instructions').render({ webgl_supported: !!finch.game.views.battlefield_particle_effects }).trim());
		
		$('#battlefield').append($instructions);
		this.push_window($instructions);
		
		$instructions.find('.start-button').click(function() {			
			_this.start_olympic_game();			
		});
	},
	
	show_leaderboard: function(mode, round_id) {
		this._show_leaderboards(mode, round_id);
	},
	
	show_leaderboards: function() {
		this._show_leaderboards('queue');
	},
	
	_show_leaderboards: function(mode, round_id) {
		var _this = this;		
		if(!mode)
			mode = 'queue';
		
		var show_leaderboard_pane = function(mode, span, id) {
			if(!id) {
				id = 0
			}
			$leaderboards.find('.leaderboard-results-slot').html($("<div class='leaderboard-waiter'></div>"));
			$('#leaderboard-view-mode, #leaderboard-view-span').attr("disabled", "disabled");
			$.getJSON('/trainer-leaderboard/' + mode + '/' + span + '/' + id)
				.done(function(result) {
					var $leaderboard_pane = $($('#leaderboard-pane').render({
						mode: mode,
						history: result.rounds,
						total: result.total,
						highlighted_id: id
					}).trim());
					$leaderboards.find(".leaderboard-results-slot").html($leaderboard_pane);
					$leaderboard_pane.fadeIn();
				})
				.fail(function() {
					$leaderboards.find(".leaderboard-results-slot").html($('<div class="error">there was an error, click to retry</div>'));
					$leaderboards.find(".leaderboard-results-slot > div").click(function() {
						show_leaderboard_pane(mode);
					});
				})
				.always(function() {
					$('#leaderboard-view-mode, #leaderboard-view-span').removeAttr("disabled");
				});
		};
		
		//checking to see if this is the active window already
		var $window = this.view_stack[this.view_stack.length-1];
		if($window.find('#leaderboard-view-mode').length) {			
			var $leaderboards = $window;
		}else{
			var $leaderboards = $($('#leaderboards').render().trim());
			$leaderboards.find('#leaderboard-view-mode, #leaderboard-view-span').on('change', function() {
				show_leaderboard_pane($('#leaderboard-view-mode').val(), $('#leaderboard-view-span').val());
			});
			
			$('#battlefield').append($leaderboards);		
			this.push_window($leaderboards);
		}
						
		if(mode == 'olympic')
			$('#leaderboard-view-span').val('olympic');
		$('#leaderboard-view-mode').val(mode);
		show_leaderboard_pane(mode, $('#leaderboard-view-span').val(), round_id);		
	},	
	
	show_offensive_game_over: function(milliseconds_to_complete, total_combos) {		
		var $game_over_window =$($('#offensive-mode-game-over').render().trim());
		$game_over_window.find('.seconds').text(Math.floor(milliseconds_to_complete/1000));
		$game_over_window.find('.combo-count').text(total_combos+1);
		$('#battlefield').append($game_over_window);
		var _this = this;
		$game_over_window.find('.start-button').click(function() {
			_this.start_offensive_game.call(_this);
			_this.view_stack.pop(); /* get rid of this window since it will be re-added at the end of the match */
		});
		this.push_window($game_over_window);
		this.show();
	},
	
	show_olympic_game_over: function(milliseconds_to_complete) {		
		var $game_over_window =$($('#olympic-mode-game-over').render().trim());
		$game_over_window.find('.seconds').text(Math.floor(milliseconds_to_complete/1000));
		
		$('#battlefield').append($game_over_window);
		var _this = this;
		$game_over_window.find('.start-button').click(function() {
			_this.start_olympic_game.call(_this);
			_this.view_stack.pop(); /* get rid of this window since it will be re-added at the end of the match */
		});
		this.push_window($game_over_window);
		this.show();
	},
	
	push_window: function(window) {
		var $current_window = this.view_stack[this.view_stack.length-1];
		this.view_stack.push(window);
		$current_window.animate({
			'left': -$current_window.outerWidth()
		}, 300, function() { window.fadeIn(); });		
		this.center();		
		
		var _this = this;
		window.find('.nav-back').click(function() {
			_this.pop_window();
		});
	},
	
	pop_window: function() {
		var $popped_window = this.view_stack.pop();
		var _this = this;
		$popped_window.fadeOut(function() {
			_this.center(animate=true, show_immediately=true);
			$popped_window.remove();
		});
	},
	
	start_offensive_game: function() {
		var _this = this;
		var callback = function() {
			finch.game.statebag = {};
			finch.game.controls.elements.stop_casting();
			finch.game.set_mode('offensive');
			finch.game.start();
			finch.game.opponent.max_health = _this.view_stack[_this.view_stack.length-1].find('.health').val();
			finch.game.opponent.spell_delay_modifier = _this.view_stack[_this.view_stack.length-1].find('.difficulty').val();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.set_top_padding(230);
			finch.game.views.queued_elements.show()			
			finch.game.opponent.set_default_values();
			finch.game.opponent.skynet_enabled();
			finch.game.controls.elements.show_cast_bar = true;
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.fadeOut('fast');				
		this.set_game_mode_text('Attack the Enemy');
	},
	
	start_queue_game: function() {
		var callback = function() {
			finch.game.statebag = {};
			finch.game.set_mode('queue');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.set_top_padding(0);
			finch.game.views.queued_elements.show()
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.fadeOut('fast');				
		this.set_game_mode_text('Queue Shown Elements');
	},
	
	start_dequeue_game: function() {
		var callback = function() {
			finch.game.statebag = {};
			finch.game.set_mode('dequeue');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.set_top_padding(0);
			finch.game.views.queued_elements.show();
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.fadeOut('fast');		
		this.set_game_mode_text('Cancel Queued Elements');
	},
	
	start_olympic_game: function() {
		var callback = function() {
			finch.game.statebag = {};
			finch.game.controls.elements.stop_casting();
			finch.game.set_mode('olympic');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.set_top_padding(0);
			finch.game.views.queued_elements.show()
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.fadeOut('fast');				
		this.set_game_mode_text('Wizard Olympics');
	},
	
	fadeIn: function(speed) {
		this.view_stack[this.view_stack.length-1].fadeIn(speed);
	},
	
	fadeOut: function(speed) {
		this.view_stack[this.view_stack.length-1].fadeOut(speed);
	},
	
	show_countdown: function(callback) {
		var $countdown_original = $('<div class="countdown">3</div>');
		$("#battlefield").append($countdown_original);
		$countdown_original.css({
			'position': 'absolute',
			'top': $('#battlefield').height()/2 - $countdown_original.height()/2,
			'left': ($('#battlefield').width()-$('#round-history-slot').width())/2 - $countdown_original.width()/2,
			'display': 'none'
		});
				
		this.countdown_timer = clearTimeout(this.countdown_timer);
		var _this = this;
		var advance_countdown = function(cnt) {			
			var $countdown = $countdown_original.clone();
			$('#battlefield').append($countdown);
			$countdown.text(cnt).show();
			$countdown.effect('puff', {percent:300}, 500, function() {				
				$countdown.remove();
			});
			
			_this.countdown_timer = setTimeout(function() {
				if(cnt==1) {
					if(_this.countdown_timer) callback();
					$countdown_original.remove();
				}else{
					if(_this.countdown_timer) advance_countdown(cnt-1);
				}
			}, 1000);
			
		};
		
		this.countdown_timer = setTimeout(function() { advance_countdown(3); }, 1);
	},
	
	set_game_mode_text: function(text) {
		$('#game-mode-display').text(text);
	},
	
	show: function() {
		$('#cancel-game').hide();
		this.fadeIn('fast');
		this.set_game_mode_text('None Selected');
		this.center();
	},
	
	center: function(animate, show_immediately) {
		var $window = this.view_stack[this.view_stack.length-1];
		if(show_immediately) $window.show();
		
		var css = {			
				'top': $('#game-title-slot').height()/2 + $('#battlefield').innerHeight()/2 - $window.outerHeight()/2,
				'left': ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth())/2 - this.$el.outerWidth()/2			
			}; 
		if(animate){
			$window.animate(css, 300);
		}else {
			$window.css(css);
		}
	}
});

views.Elements = Backbone.View.extend({
	el: $('#player-controls-slot'),
	events: {
		'click #edit-keybindings': 'edit_keybindings',
		'keydown #keybindings > div > div input': 'set_keybinding',
		'click #cancel-keybindings': 'hide_keybindings',
		'click #save-keybindings': 'save_keybindings',
		'click .cast-button > div': 'change_cast_button',
	},
	initialize: function() {
		this.model.on("change:pressed_elements", this.handle_pressed_elements.bind(this));
		this.model.on("change:keybindings", this.render.bind(this));
		
	},	
	handle_pressed_elements: function(model, pressed_elements) {		
		this.$el.find('.pressed').removeClass('pressed');
		var _this = this;
		for(var element in pressed_elements) {		
			this.$el.find('.' + element).addClass('pressed');
		}
	},	
	edit_keybindings: function() {
		$('#keybindings').fadeIn();
		//set keybindings to current
		for(key in this.model.keybindings) {
			if(this.model.keybindings.hasOwnProperty(key)) {
				var element = this.model.keybindings[key];
				$('#' + element + '-keybinding').val(key.toUpperCase());
			}
		}
		
		$('.cast-button > div', this.$el).removeClass('selected');
		$('#cast-' + this.model.mouse_cast_button + '-click').addClass('selected');
	},
	set_keybinding: function(evt) {
		$(evt.target).val(String.fromCharCode(evt.which).toUpperCase());	
		evt.preventDefault();
		
		//find another one that has this setting and unset it
		this.$el.find("input[id$='keybinding']").not(evt.target).each(function() {
			if($.trim($(this).val()) == $.trim($(evt.target).val())) {
				$(this).val('');
			}
		});
	},
	hide_keybindings: function() {
		$('#keybindings').fadeOut();		
	},
	change_cast_button: function(evt) {
		$('.cast-button > div', this.$el).removeClass('selected');
		$(evt.target).addClass('selected');
	},
	save_keybindings: function() {
		//create keybinding array, checking for blanks
		var keybindings = [];
		this.$el.find("input[id$='keybinding']").each(function() {
			var val = $.trim($(this).val());
			if(val.length) {
				keybindings.push({
					key: $.trim(val),
					element: $(this).attr('id').split('-')[0]
				});
			}else{
				$(this).effect('shake', {distance: 5})
			}
		});
		
		if(keybindings.length == 8) {
			this.model.keybindings = {};
			for(i=0;i<keybindings.length;i++) {
				this.model.keybindings[keybindings[i].key] = keybindings[i].element;
			}
			
			if($('#cast-right-click').hasClass('selected')) {
				this.model.mouse_cast_button = 'right';
			}else{
				this.model.mouse_cast_button = 'left';
			}
			
			this.update_interface_keybindings();
			this.model.persist_keybindings();
			this.hide_keybindings();
		}		
	},
	update_interface_keybindings: function() {
		for(key in this.model.keybindings) {
			if(this.model.keybindings.hasOwnProperty(key)) {
				var element = this.model.keybindings[key];
				$('#elements-controls .' + element + ' span').text(key.toUpperCase());
			}
		}
	},
	render: function() {
		var controls = this.$el.html($("#player-controls-template").render(this.model.attributes));
		this.update_interface_keybindings();
		return controls;
	}
	
});

views.QueuedElements = Backbone.View.extend({

	tagName: 'div',	
	className: 'elements element-queue',
	hide_timeout: null,
	auto_fadeout: true,
	helper_mode: false,
	top_padding:0,
	
	initialize: function() {	
		this.model.on("change:queued_elements", this.handle_queued_elements.bind(this));
		this.model.on("element_fizzle", this.handle_element_fizzle.bind(this));
		this.already_rendered = false;
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.model.on("change:casting_power", this.handle_casting_power_change.bind(this));
	},
	
	handle_casting_power_change: function() {
		var power = this.model.get('casting_power');
		var interval = 10; 
		if(this.model.show_cast_bar) {
			this.$el.find('.cast-bar').show();
		}		
		if(power == 0) {			
			this.$el.find('.cast-bar').hide();
		}
		this.$el.find('.cast-bar div')
			.stop()
			.css({ width: Math.max(power-interval, 0) + '%' })
			.animate({ width: power + '%' }, 150, 'linear');
	},
	
	handle_queued_elements: function(model, queued_elements) {
		this.render();		
	},
	
	handle_element_fizzle: function(model, element_index, requested_element) {
		var $fizzled_element = $(this.$el.find('> div').get(element_index+1 /* first element is cast bar */));
		var $clone = $("<div class='elements'></div>");
		$clone.append($fizzled_element.clone());
		$clone.css({
			position: 'absolute',
			marginLeft: 0, 
			marginTop: 0, 
			top: $fizzled_element.offset().top,
			left: $fizzled_element.offset().left
		});
		$clone.addClass('fizzling').remove().appendTo('body');
		var $requested = $clone.clone();
		$clone.animate({
				top: '-=50',
				opacity: '0',
			}, 500, 'linear', function() {				
				$(this).remove();
			});
		$requested.find('div').attr('class', requested_element + ' fizzling');
		$requested.appendTo('body').effect('shake', 400, function() {			
			$(this).remove();
		});
		
	},
	
	hide: function() {
		clearTimeout(this.hide_timeout);
		this.$el.fadeOut();
	},
	
	set_top_padding: function(padding) {
		this.top_padding = padding;
		this.center();
	},
	
	show: function() {
		this.$el.show();
	},
	
	render: function() {				
		var queued_elements = this.model.get('queued_elements');
		var conditioned_queued_elements = [];
		for(var index in queued_elements) {		
			conditioned_queued_elements.push({ name: queued_elements[index] });
		}
		for(i=0;i<3-queued_elements.length;i++) {
			conditioned_queued_elements.push({ name: 'unknown'});
		}
		this.$el.html($("#element-queue-template").render({ queued_elements: conditioned_queued_elements }));
		if(this.helper_mode) {
			this.$el.addClass('helper-mode');
		}
		
		//first time rendering position it in the middle of the playing field.
		if(!this.already_rendered) {
			this.already_rendered = true;		
			var $battlefield = $('#battlefield');
			$battlefield.append(this.$el);
			this.center();
		}
		if(!queued_elements.length) {
			if(this.auto_fadeout) {
				this.hide_timeout = setTimeout((function() { this.$el.fadeOut(); }).bind(this), 5000 );
			}
		}else{
			this.$el.show();
			this.hide_timeout = clearTimeout(this.hide_timeout);
		}
		
		if(this.model.get('casting')) {
			this.$el.find('.cast-bar').show();
			this.handle_casting_power_change();
		}
		
		return this;
		
	},
	
	center: function() {
		//position it in the middle of the battlefield by default, it can get moved though
		this.$el.css({
			top: $('#battlefield').outerHeight() / 2 - this.$el.outerHeight() / 2 - 100 - (this.helper_mode ? 50 : 0) + this.top_padding,
			left: ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth())/2 - this.$el.outerWidth()/2
		});		
	}


});

views.MessageBox = Backbone.View.extend({
	el: $('#message-box'),				
	initialize: function() {
		this.model.on("change:message", this.handle_message_change.bind(this));		
	},
	
	handle_message_change: function(model, message) {
		this.$el.stop().show().css('opacity', 1).html(message);
		this.center();
		this.$el.fadeOut(3000);		
	},
	
	center: function() {
		//position it in the middle of the battlefield by default, it can get moved though
		this.$el.css({
			top: $('#battlefield').outerHeight() / 2 - this.$el.outerHeight() / 2,
			left: ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth())/2 - this.$el.outerWidth()/2
		});		
	}
	
});

views.BackgroundMusicPlayer = Backbone.View.extend({
	el: $('#music-player'),	
	playing: true,
	audio: null,
	volume: .2,
	is_first_time: true,
	initialize: function() {
		var _this = this;
		this.process_cookie();
		$('.volume')
			.slider({
				slide: function(evt, ui) {
					_this.set_volume(ui.value/100);
					_this.fade_up_interval = clearInterval(_this.fade_up_interval);
				},
				value: _this.volume*100
			});
			
		$('.play-pause').on('click', this.handle_playpause_click.bind(this));
		this.audio = new Audio('/static/music/magicka-idle.mp3');
						
		this.audio.addEventListener('ended', function() {
			this.pause();
			this.load();
		    this.play();
		}, false);		
		if(this.playing)
			this.play();
		this.audio.volume = .01		
				
		if(this.is_first_time) {
			//this will happen based on a cookie
			this.flash_music_first_time();
		}
		this.fade_up_interval = setInterval(function() {			
			_this.audio.volume+=.01;
			$('.volume').slider({value:_this.audio.volume*100});
			if(_this.audio.volume > _this.volume)
				_this.fade_up_interval = clearInterval(_this.fade_up_interval);
		}, 100);
	},
	play: function() {
		this.playing = false;
		this.handle_playpause_click();
	},
	handle_playpause_click: function() {	
		this.fade_up_interval = clearInterval(this.fade_up_interval);
		var $button = this.$el.find('.play-pause');
		this.playing = !this.playing;
		this.save_cookie();
		
		$button
			.removeClass('paused')
			.removeClass('playing');
		
		if(this.playing) {	
			this.audio.play();
			$button.addClass('playing')
		}else{
			this.audio.pause();
			$button.addClass('paused');
		}				
	},
	set_volume: function(value) {
		this.audio.volume = value;
		this.volume = value;
		this.save_cookie();
	},
	process_cookie: function() {
		var audio_settings = $.cookie('audio-settings');
		if(audio_settings) {
			this.is_first_time = false;
			var settings = JSON.parse(audio_settings);
			this.volume = settings.volume;
			this.playing = settings.playing;
		}else{
			this.save_cookie();
		}
	},
	save_cookie: function() {
		$.cookie('audio-settings', JSON.stringify({
			playing: this.playing,
			volume: this.volume,
			is_first_time: this.is_first_time
		}));
	},
	flash_music_first_time: function() {
		var flash_timer = 4;
		var _this = this;
		
		var flash_it = function() {
			_this.$el.effect('highlight');
			if(flash_timer-- > 0)
				setTimeout(flash_it, 300);
		};
		setTimeout(flash_it, 300);
	}
});

views.Credits = Backbone.View.extend({
	el: $('#credits-banner'),
	events: {
		'click': 'handle_click'
	},
	initialize: function() {
		finch.game.views.global.on('smart_resize', this.center_credits.bind(this));
		$('#credits-content, #credits-window .nav-back').on('click', this.hide_credits.bind(this));
		$('#credits-window').click(function(evt) {
			evt.stopPropagation();
		})
	},
	handle_click: function() {
		this.show_credits();
	},
	hide_credits: function() {
		$('#credits-content').fadeOut('fast');
	},
	show_credits: function() {
		$('#credits-content').fadeIn('fast');
		this.center_credits();
	},
	center_credits: function() {		
		$('#credits-window').css({
			top: $('#credits-content').innerHeight()/2 - $('#credits-window').outerHeight()/2,
			left: $('#credits-content').innerWidth()/2 - $('#credits-window').outerWidth()/2
		});
	}
});

views.LeaderboardSubmit = Backbone.View.extend({
	el: $('#leaderboard-name-window'),
	save_triggered: false,
	events: {
		'click #save-score-no-name': 'save_score_without_name',
		'click #save-score-yes-name': 'save_score_with_name',		
	},
	initialize: function() {
		if($('#leaderboard-country option').length <= 1) {
			for(i=0;i<CountryCodes.length;i++) {
				$('#leaderboard-country').append($("<option value=\"" + CountryCodes[i].code +"\">" + CountryCodes[i].name + "</option>"));
			}
		}
	},	
	save_score_without_name: function() {
		if(!this.save_triggered) {
			this.save_triggered = true;
			
			this.trigger('save');
			this.fadeOut();
		}
	}, 
	save_score_with_name: function() {
		if(!this.save_triggered) {
			if($('#leaderboard-name').val().trim().length == 0) {
				$('#leaderboard-name').effect('shake');
			}else{
				this.trigger('save', $('#leaderboard-name').val(), $('#leaderboard-country').val());
				this.fadeOut();
				this.save_triggered = true;
			}
		}
	}, 
	fadeIn: function() {
		this.center();
		$('#leaderboard-modal-background').fadeIn('fast');
		this.$el.fadeIn('fast');
		$('#leaderboard-name').focus();
	},
	fadeOut: function() {
		$('#leaderboard-modal-background').fadeOut('fast');
		this.$el.fadeOut('fast');
	},	
	center: function() {		 
		this.$el.css({
			top: $('#game-title-slot').height()/2 + $('#battlefield').innerHeight()/2 - this.$el.outerHeight()/2,
			left: ($('#battlefield').innerWidth()-$('#round-history-slot').outerWidth())/2 - this.$el.outerWidth()/2
		});
	}
});

/** end views **/

/** csrf support **/

$(document).ajaxSend(function(event, xhr, settings) {
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    function sameOrigin(url) {
        // url could be relative or scheme relative or absolute
        var host = document.location.host; // host + port
        var protocol = document.location.protocol;
        var sr_origin = '//' + host;
        var origin = protocol + sr_origin;
        // Allow absolute or scheme relative URLs to same origin
        return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
            (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
            // or any other URL that isn't scheme relative or absolute i.e relative.
            !(/^(\/\/|http:|https:).*/.test(url));
    }
    function safeMethod(method) {
        return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
    }

    if (!safeMethod(settings.type) && sameOrigin(settings.url)) {
        xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
    }
});

/** end csrf support **/

finch.game = {	
	round_length: 10,
	minimum_leaderboard_round_length: 10,
	statebag: {},
	paused: true,
	set_mode: function(mode) {
		finch.game.statebag.mode = mode;
	},		
	start: function() {		
		finch.game.unpause();
				
		if(!finch.game.initialized) {
			finch.game.initialized = true;
			//create all uninitialized models					
			finch.game.opponent = new models.Opponent();
			finch.game.objective_history = new models.ObjectiveHistory();
			finch.game.round_history = new models.RoundHistory();
			
			finch.game.views.queued_elements = new views.QueuedElements({ model:finch.game.controls.elements });
			finch.game.views.queued_elements.auto_fadeout = false;
			
			finch.game.views.queued_elements_helper = new views.QueuedElements({ model:finch.game.controls.elements_helper });
			finch.game.views.queued_elements_helper.auto_fadeout = false;
			finch.game.views.queued_elements_helper.helper_mode = true;
			finch.game.views.opponent = new views.Opponent({ model:finch.game.opponent });
			
			finch.game.views.objective_history = new views.ObjectiveHistory({ model:finch.game.objective_history });
			finch.game.views.round_history = new views.RoundHistory({ model:finch.game.round_history });
			
			finch.game.controls.elements.on("element_queue_try", function(model) {
				if(finch.game.loading_next_objective || finch.game.paused)
					return;
				
				finch.game.statebag.objective_keypresses++;
			});
			
			finch.game.controls.elements.on("change:queued_elements", function(model, queued_elements) {			
				if(finch.game.loading_next_objective || finch.game.paused)
					return;
				
				var dequeue_mode_listener = function() {
					if(queued_elements.length == 0) {
						var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
						var fumble = finch.game.statebag.objective_keypresses > 3;
						
						finch.game.objective_history.add_history(elapsed_time, finch.game.last_objective, fumble);
						if(finch.game.objective_history.get('history').length < finch.game.round_length)
							finch.game.load_next_objective();
					}
				};
				
				var queue_mode_listener = function() {
					if(finch.game.controls.elements_helper.matches_elements(queued_elements)) {
						var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
						var fumble = finch.game.statebag.objective_keypresses > 3;
						finch.game.controls.elements.clear_queued_elements();
						
						finch.game.objective_history.add_history(elapsed_time, queued_elements, fumble);
						if(finch.game.objective_history.get('history').length < finch.game.round_length)
							finch.game.load_next_objective();
					}
				};
				
				switch(finch.game.statebag.mode) {
					case 'dequeue':
						dequeue_mode_listener();
						break;
					case 'queue':
						queue_mode_listener();
						break;
					case 'olympic':
						switch(finch.game.statebag.olympic_stage) {
							case 'dequeue':
								dequeue_mode_listener();
								break;
							case 'queue':
								queue_mode_listener();
								break;
						}
				}				
			});			
			finch.game.objective_history.on("change:history", function(model, history) {
				if(finch.game.statebag.mode != 'offensive' && !(finch.game.statebag.mode == 'olympic' && finch.game.statebag.olympic_stage == 'offensive')) {
					finch.game.controls.elements.clear_queued_elements();												
										
					if(history.length === finch.game.round_length) {
						if(finch.game.statebag.mode == 'olympic') {
							switch(finch.game.statebag.olympic_stage) {
								case 'queue':
									finch.game.message_box.set_message('starting dequeue mode...');
									finch.game.statebag.olympic_stage = 'dequeue';
									finch.game.views.queued_elements.set_top_padding(0);
									finch.game.views.queued_elements.show();
																		
									finch.game.statebag.olympic_history = finch.game.statebag.olympic_history.concat(finch.game.objective_history.get('history'));
									finch.game.objective_history.clear();
									finch.game.views.queued_elements_helper.hide()
									finch.game.views.objective_history.hide();
									finch.game.load_next_objective();
									break;
								case 'dequeue':
									finch.game.message_box.set_message('starting offensive mode...');
									finch.game.statebag.olympic_stage = 'offensive';
									finch.game.statebag.olympic_history = finch.game.statebag.olympic_history.concat(finch.game.objective_history.get('history'));
									finch.game.objective_history.clear();									
									finch.game.views.objective_history.hide();									
									finch.game.views.queued_elements.set_top_padding(230);
									finch.game.views.queued_elements.show()
									
									finch.game.load_next_objective();
									finch.game.opponent.set_default_values();
									finch.game.opponent.skynet_enabled();
									finch.game.controls.elements.show_cast_bar = true;
									break;
							}
						}else{
							finch.game.pause();
							finch.game.views.queued_elements.hide()
							finch.game.views.queued_elements_helper.hide()
							finch.game.views.mode_selection.show();
														
							finch.game.views.objective_history.transition_to_round_history(function() {
								finch.game.round_history.add_history(finch.game.statebag.mode, history);
								finch.game.round_history.save_history(finch.game.statebag.mode, history);
								finch.game.stats_overview.update();
								finch.game.objective_history.clear();
							});
						}												
					}
				}
			});
			finch.game.opponent.on('change:health', function(model, health) {
				if(finch.game.statebag.mode == 'offensive' || (finch.game.statebag.mode == 'olympic' && finch.game.statebag.olympic_stage == 'offensive')) {
					if(health <= 0 && !finch.game.paused) {
						finch.game.opponent.skynet_disabled();
						finch.game.controls.elements.show_cast_bar = false;
						finch.game.pause();
						finch.game.controls.elements.clear_queued_elements();
						finch.game.views.queued_elements.hide()
						finch.game.views.queued_elements_helper.hide()
						finch.game.views.opponent.hide();
						finch.game.views.battlefield_particle_effects.hide();
						finch.game.views.battlefield_line_effects.hide();
						
						var history = finch.game.objective_history.get('history');
						var combo_parser = finch.game.controls.elements.casting_combo_parser;
						if(combo_parser) {
							var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
							finch.game.objective_history.add_history(elapsed_time, combo_parser.get('elements'), fumble=false, is_offensive=true);						
						}
						if(finch.game.statebag.mode == 'olympic') {
							history = finch.game.statebag.olympic_history.concat(history);
						}
						
						finch.game.views.objective_history.transition_to_round_history(function() {							
							finch.game.round_history.add_history(finch.game.statebag.mode, history);
							var additional_attrs = {
								spell_delay_modifier : finch.game.opponent.spell_delay_modifier,
								enemy_health : finch.game.opponent.max_health
							}
							finch.game.round_history.save_history(finch.game.statebag.mode, history, additional_attrs);
							finch.game.stats_overview.update();
							finch.game.objective_history.clear();
						});
						
						if(finch.game.statebag.mode == 'offensive') {
							finch.game.views.mode_selection.show_offensive_game_over(elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time, combo_count = history.length);
						}else{
							finch.game.views.mode_selection.show_olympic_game_over(elapsed_time = (new Date()).getTime() - finch.game.statebag.olympic_mode_start_time);
						}
					}
				}
			});
			finch.game.controls.elements.on('cast_stop', function() {
				if(!finch.game.paused) {
					if(finch.game.statebag.mode == 'offensive' || (finch.game.statebag.mode == 'olympic' && finch.game.statebag.olympic_stage == 'offensive')) {					
						var combo_parser = finch.game.controls.elements.casting_combo_parser;
						if(combo_parser) {
							var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
							finch.game.objective_history.add_history(elapsed_time, combo_parser.get('elements'), fumble=false, is_offensive=true);						
						}
					}
				}
			});
		}
	},
	pause: function() {
		finch.game.paused = true;
	},
	unpause: function() {
		finch.game.paused = false;
	},
	views: {
		global: new views.Global()
	},	
	load_next_objective: function() {		
		finch.game.loading_next_objective = true;
		finch.game.statebag.objective_keypresses = 0;
		finch.game.last_objective_start_time = (new Date()).getTime();
		if(!finch.game.statebag.tokens) {
			finch.game.statebag.tokens = [];
			$.getJSON('/trainer-token/', function(result) {
				finch.game.statebag.tokens[0] = result.token;
			});
		}
		
		switch(finch.game.statebag.mode) {
			case 'dequeue': 
				this.load_dequeue_objective();
				break;
			case 'queue':
				this.load_queue_objective();
				break;
			case 'offensive':
				this.load_offensive_objective();
				break;
			case 'olympic':
				if(!finch.game.statebag.olympic_stage) {
					finch.game.statebag.olympic_stage = 'queue';
					finch.game.statebag.olympic_mode_start_time = (new Date()).getTime();
					finch.game.statebag.olympic_history = [];
				}
				
				switch(finch.game.statebag.olympic_stage) {
					case 'queue':
						finch.game.round_length = 10;
						this.load_queue_objective();
						break;
					case 'dequeue':
						finch.game.round_length = 10;
						this.load_dequeue_objective();
						break;
					case 'offensive':
						finch.game.opponent.max_health = 1000;
						finch.game.opponent.spell_delay_modifier = 1;
						this.load_offensive_objective();
						break;
				}
				break;
		}
		
		finch.game.last_objective = finch.game.controls.elements.get('queued_elements').slice(0);
		finch.game.loading_next_objective = false;
	},
	load_dequeue_objective: function() {
		finch.game.controls.elements.queue_random_elements();
	},
	load_queue_objective: function() {
		finch.game.views.queued_elements.render();
		finch.game.views.queued_elements_helper.render();
		finch.game.controls.elements_helper.queue_random_elements();
	},
	load_offensive_objective: function() {
		finch.game.views.queued_elements.render();
		finch.game.views.opponent.render();
		finch.game.views.battlefield_particle_effects.show();
		finch.game.views.battlefield_line_effects.show();
	}
};
finch.game.controls = {		
	elements: new models.controls.Elements(),
	elements_helper: new models.controls.Elements({ ignore_keystrokes: true }),		
}

finch.game.views.elements = new views.Elements({ suppress_fizzle: true, model:finch.game.controls.elements });

var CountryCodes = [
    {
        code: "AF",
        name: "Afghanistan"
    },
    {
        code: "AL",
        name: "Albania"
    },
    {
        code: "DZ",
        name: "Algeria"
    },
    {
        code: "AS",
        name: "American Samoa"
    },
    {
        code: "AD",
        name: "Andorra"
    },
    {
        code: "AO",
        name: "Angola"
    },
    {
        code: "AI",
        name: "Anguilla"
    },
    {
        code: "AQ",
        name: "Antarctica"
    },
    {
        code: "AG",
        name: "Antigua and Barbuda"
    },
    {
        code: "AR",
        name: "Argentina"
    },
    {
        code: "AM",
        name: "Armenia"
    },
    {
        code: "AW",
        name: "Aruba"
    },
    {
        code: "AU",
        name: "Australia"
    },
    {
        code: "AT",
        name: "Austria"
    },
    {
        code: "AZ",
        name: "Azerbaijan"
    },
    {
        code: "BS",
        name: "Bahamas"
    },
    {
        code: "BH",
        name: "Bahrain"
    },
    {
        code: "BD",
        name: "Bangladesh"
    },
    {
        code: "BB",
        name: "Barbados"
    },
    {
        code: "BY",
        name: "Belarus"
    },
    {
        code: "BE",
        name: "Belgium"
    },
    {
        code: "BZ",
        name: "Belize"
    },
    {
        code: "BJ",
        name: "Benin"
    },
    {
        code: "BM",
        name: "Bermuda"
    },
    {
        code: "BT",
        name: "Bhutan"
    },
    {
        code: "BO",
        name: "Bolivia, Plurinational State Of"
    },
    {
        code: "BQ",
        name: "Bonaire, Sint Eustatius and Saba"
    },
    {
        code: "BA",
        name: "Bosnia and Herzegovina"
    },
    {
        code: "BW",
        name: "Botswana"
    },
    {
        code: "BV",
        name: "Bouvet Island"
    },
    {
        code: "BR",
        name: "Brazil"
    },
    {
        code: "IO",
        name: "British Indian Ocean Territory"
    },
    {
        code: "BN",
        name: "Brunei Darussalam"
    },
    {
        code: "BG",
        name: "Bulgaria"
    },
    {
        code: "BF",
        name: "Burkina Faso"
    },
    {
        code: "BI",
        name: "Burundi"
    },
    {
        code: "KH",
        name: "Cambodia"
    },
    {
        code: "CM",
        name: "Cameroon"
    },
    {
        code: "CA",
        name: "Canada"
    },
    {
        code: "CV",
        name: "Cape Verde"
    },
    {
        code: "KY",
        name: "Cayman Islands"
    },
    {
        code: "CF",
        name: "Central African Republic"
    },
    {
        code: "TD",
        name: "Chad"
    },
    {
        code: "CL",
        name: "Chile"
    },
    {
        code: "CN",
        name: "China"
    },
    {
        code: "CX",
        name: "Christmas Island"
    },
    {
        code: "CC",
        name: "Cocos (Keeling) Islands"
    },
    {
        code: "CO",
        name: "Colombia"
    },
    {
        code: "KM",
        name: "Comoros"
    },
    {
        code: "CG",
        name: "Congo"
    },
    {
        code: "CD",
        name: "Congo The Democratic Rep."
    },
    {
        code: "CK",
        name: "Cook Islands"
    },
    {
        code: "CR",
        name: "Costa Rica"
    },
    {
        code: "HR",
        name: "Croatia"
    },
    {
        code: "CU",
        name: "Cuba"
    },
    {
        code: "CW",
        name: "Curacao"
    },
    {
        code: "CY",
        name: "Cyprus"
    },
    {
        code: "CZ",
        name: "Czech Republic"
    },
    {
        code: "CI",
        name: "Cote D\'Ivoire"
    },
    {
        code: "DK",
        name: "Denmark"
    },
    {
        code: "DJ",
        name: "Djibouti"
    },
    {
        code: "DM",
        name: "Dominica"
    },
    {
        code: "DO",
        name: "Dominican Republic"
    },
    {
        code: "EC",
        name: "Ecuador"
    },
    {
        code: "EG",
        name: "Egypt"
    },
    {
        code: "SV",
        name: "El Salvador"
    },
    {
        code: "GQ",
        name: "Equatorial Guinea"
    },
    {
        code: "ER",
        name: "Eritrea"
    },
    {
        code: "EE",
        name: "Estonia"
    },
    {
        code: "ET",
        name: "Ethiopia"
    },
    {
        code: "FK",
        name: "Falkland Islands  (Malvinas)"
    },
    {
        code: "FO",
        name: "Faroe Islands"
    },
    {
        code: "FJ",
        name: "Fiji"
    },
    {
        code: "FI",
        name: "Finland"
    },
    {
        code: "FR",
        name: "France"
    },
    {
        code: "GF",
        name: "French Guiana"
    },
    {
        code: "PF",
        name: "French Polynesia"
    },
    {
        code: "TF",
        name: "French Southern Territories"
    },
    {
        code: "GA",
        name: "Gabon"
    },
    {
        code: "GM",
        name: "Gambia"
    },
    {
        code: "GE",
        name: "Georgia"
    },
    {
        code: "DE",
        name: "Germany"
    },
    {
        code: "GH",
        name: "Ghana"
    },
    {
        code: "GI",
        name: "Gibraltar"
    },
    {
        code: "GR",
        name: "Greece"
    },
    {
        code: "GL",
        name: "Greenland"
    },
    {
        code: "GD",
        name: "Grenada"
    },
    {
        code: "GP",
        name: "Guadeloupe"
    },
    {
        code: "GU",
        name: "Guam"
    },
    {
        code: "GT",
        name: "Guatemala"
    },
    {
        code: "GG",
        name: "Guernsey"
    },
    {
        code: "GN",
        name: "Guinea"
    },
    {
        code: "GW",
        name: "Guinea-Bissau"
    },
    {
        code: "GY",
        name: "Guyana"
    },
    {
        code: "HT",
        name: "Haiti"
    },    
    {
        code: "VA",
        name: "Holy See (Vatican City State)"
    },
    {
        code: "HN",
        name: "Honduras"
    },
    {
        code: "HK",
        name: "Hong Kong"
    },
    {
        code: "HU",
        name: "Hungary"
    },
    {
        code: "IS",
        name: "Iceland"
    },
    {
        code: "IN",
        name: "India"
    },
    {
        code: "ID",
        name: "Indonesia"
    },
    {
        code: "IR",
        name: "Iran, Islamic Republic Of"
    },
    {
        code: "IQ",
        name: "Iraq"
    },
    {
        code: "IE",
        name: "Ireland"
    },
    {
        code: "IM",
        name: "Isle of Man"
    },
    {
        code: "IL",
        name: "Israel"
    },
    {
        code: "IT",
        name: "Italy"
    },
    {
        code: "JM",
        name: "Jamaica"
    },
    {
        code: "JP",
        name: "Japan"
    },
    {
        code: "JE",
        name: "Jersey"
    },
    {
        code: "JO",
        name: "Jordan"
    },
    {
        code: "KZ",
        name: "Kazakhstan"
    },
    {
        code: "KE",
        name: "Kenya"
    },
    {
        code: "KI",
        name: "Kiribati"
    },
    {
        code: "KP",
        name: "Korea, Democratic People\'s Rep."
    },
    {
        code: "KR",
        name: "Korea, Republic of"
    },
    {
        code: "KW",
        name: "Kuwait"
    },
    {
        code: "KG",
        name: "Kyrgyzstan"
    },
    {
        code: "LA",
        name: "Lao People\'s Democratic Rep."
    },
    {
        code: "LV",
        name: "Latvia"
    },
    {
        code: "LB",
        name: "Lebanon"
    },
    {
        code: "LS",
        name: "Lesotho"
    },
    {
        code: "LR",
        name: "Liberia"
    },
    {
        code: "LY",
        name: "Libya"
    },
    {
        code: "LI",
        name: "Liechtenstein"
    },
    {
        code: "LT",
        name: "Lithuania"
    },
    {
        code: "LU",
        name: "Luxembourg"
    },
    {
        code: "MO",
        name: "Macao"
    },
    {
        code: "MK",
        name: "Macedonia"
    },
    {
        code: "MG",
        name: "Madagascar"
    },
    {
        code: "MW",
        name: "Malawi"
    },
    {
        code: "MY",
        name: "Malaysia"
    },
    {
        code: "MV",
        name: "Maldives"
    },
    {
        code: "ML",
        name: "Mali"
    },
    {
        code: "MT",
        name: "Malta"
    },
    {
        code: "MH",
        name: "Marshall Islands"
    },
    {
        code: "MQ",
        name: "Martinique"
    },
    {
        code: "MR",
        name: "Mauritania"
    },
    {
        code: "MU",
        name: "Mauritius"
    },
    {
        code: "YT",
        name: "Mayotte"
    },
    {
        code: "MX",
        name: "Mexico"
    },
    {
        code: "FM",
        name: "Micronesia, Federated States Of"
    },
    {
        code: "MD",
        name: "Moldova, Republic of"
    },
    {
        code: "MC",
        name: "Monaco"
    },
    {
        code: "MN",
        name: "Mongolia"
    },
    {
        code: "ME",
        name: "Montenegro"
    },
    {
        code: "MS",
        name: "Montserrat"
    },
    {
        code: "MA",
        name: "Morocco"
    },
    {
        code: "MZ",
        name: "Mozambique"
    },
    {
        code: "MM",
        name: "Myanmar"
    },
    {
        code: "NA",
        name: "Namibia"
    },
    {
        code: "NR",
        name: "Nauru"
    },
    {
        code: "NP",
        name: "Nepal"
    },
    {
        code: "NL",
        name: "Netherlands"
    },
    {
        code: "NC",
        name: "New Caledonia"
    },
    {
        code: "NZ",
        name: "New Zealand"
    },
    {
        code: "NI",
        name: "Nicaragua"
    },
    {
        code: "NE",
        name: "Niger"
    },
    {
        code: "NG",
        name: "Nigeria"
    },
    {
        code: "NU",
        name: "Niue"
    },
    {
        code: "NF",
        name: "Norfolk Island"
    },
    {
        code: "MP",
        name: "Northern Mariana Islands"
    },
    {
        code: "NO",
        name: "Norway"
    },
    {
        code: "OM",
        name: "Oman"
    },
    {
        code: "PK",
        name: "Pakistan"
    },
    {
        code: "PW",
        name: "Palau"
    },
    {
        code: "PS",
        name: "Palestinian Territory, Occupied"
    },
    {
        code: "PA",
        name: "Panama"
    },
    {
        code: "PG",
        name: "Papua New Guinea"
    },
    {
        code: "PY",
        name: "Paraguay"
    },
    {
        code: "PE",
        name: "Peru"
    },
    {
        code: "PH",
        name: "Philippines"
    },
    {
        code: "PN",
        name: "Pitcairn"
    },
    {
        code: "PL",
        name: "Poland"
    },
    {
        code: "PT",
        name: "Portugal"
    },
    {
        code: "PR",
        name: "Puerto Rico"
    },
    {
        code: "QA",
        name: "Qatar"
    },
    {
        code: "RO",
        name: "Romania"
    },
    {
        code: "RU",
        name: "Russian Federation"
    },
    {
        code: "RW",
        name: "Rwanda"
    },
    {
        code: "RE",
        name: "Reunion"
    },
    {
        code: "BL",
        name: "Saint Barthelemy"
    },
    {
        code: "SH",
        name: "Saint Helena"
    },
    {
        code: "KN",
        name: "Saint Kitts And Nevis"
    },
    {
        code: "LC",
        name: "Saint Lucia"
    },
    {
        code: "MF",
        name: "Saint Martin (French Part)"
    },
    {
        code: "PM",
        name: "Saint Pierre And Miquelon"
    },    
    {
        code: "WS",
        name: "Samoa"
    },
    {
        code: "SM",
        name: "San Marino"
    },
    {
        code: "ST",
        name: "Sao Tome and Principe"
    },
    {
        code: "SA",
        name: "Saudi Arabia"
    },
    {
        code: "SN",
        name: "Senegal"
    },
    {
        code: "RS",
        name: "Serbia"
    },
    {
        code: "SC",
        name: "Seychelles"
    },
    {
        code: "SL",
        name: "Sierra Leone"
    },
    {
        code: "SG",
        name: "Singapore"
    },
    {
        code: "SX",
        name: "Sint Maarten (Dutch part)"
    },
    {
        code: "SK",
        name: "Slovakia"
    },
    {
        code: "SI",
        name: "Slovenia"
    },
    {
        code: "SB",
        name: "Solomon Islands"
    },
    {
        code: "SO",
        name: "Somalia"
    },
    {
        code: "ZA",
        name: "South Africa"
    },    
    {
        code: "SS",
        name: "South Sudan"
    },
    {
        code: "ES",
        name: "Spain"
    },
    {
        code: "LK",
        name: "Sri Lanka"
    },
    {
        code: "SD",
        name: "Sudan"
    },
    {
        code: "SR",
        name: "Suriname"
    },
    {
        code: "SJ",
        name: "Svalbard And Jan Mayen"
    },
    {
        code: "SZ",
        name: "Swaziland"
    },
    {
        code: "SE",
        name: "Sweden"
    },
    {
        code: "CH",
        name: "Switzerland"
    },
    {
        code: "SY",
        name: "Syrian Arab Republic"
    },
    {
        code: "TW",
        name: "Taiwan, Province Of China"
    },
    {
        code: "TJ",
        name: "Tajikistan"
    },
    {
        code: "TZ",
        name: "Tanzania, United Republic of"
    },
    {
        code: "TH",
        name: "Thailand"
    },
    {
        code: "TL",
        name: "Timor-Leste"
    },
    {
        code: "TG",
        name: "Togo"
    },
    {
        code: "TK",
        name: "Tokelau"
    },
    {
        code: "TO",
        name: "Tonga"
    },
    {
        code: "TT",
        name: "Trinidad and Tobago"
    },
    {
        code: "TN",
        name: "Tunisia"
    },
    {
        code: "TR",
        name: "Turkey"
    },
    {
        code: "TM",
        name: "Turkmenistan"
    },
    {
        code: "TC",
        name: "Turks and Caicos Islands"
    },
    {
        code: "TV",
        name: "Tuvalu"
    },
    {
        code: "UG",
        name: "Uganda"
    },
    {
        code: "UA",
        name: "Ukraine"
    },
    {
        code: "AE",
        name: "United Arab Emirates"
    },
    {
        code: "GB",
        name: "United Kingdom"
    },
    {
        code: "US",
        name: "United States"
    },    
    {
        code: "UY",
        name: "Uruguay"
    },
    {
        code: "UZ",
        name: "Uzbekistan"
    },
    {
        code: "VU",
        name: "Vanuatu"
    },
    {
        code: "VE",
        name: "Venezuela, Bolivarian Republic of"
    },
    {
        code: "VN",
        name: "Viet Nam"
    },
    {
        code: "VG",
        name: "Virgin Islands, British"
    },
    {
        code: "VI",
        name: "Virgin Islands, U.S."
    },
    {
        code: "WF",
        name: "Wallis and Futuna"
    },
    {
        code: "EH",
        name: "Western Sahara"
    },
    {
        code: "YE",
        name: "Yemen"
    },
    {
        code: "ZM",
        name: "Zambia"
    },
    {
        code: "ZW",
        name: "Zimbabwe"
    },
    {
        code: "AX",
        name: "Aland Islands"
    }
];

$(function() {
	finch.game.views.mode_selection = new views.ModeSelection();
	finch.game.stats_overview = new models.StatsOverview();
	finch.game.views.stats_overview = new views.StatsOverview({ model: finch.game.stats_overview });
	finch.game.views.stats_overview.render();
	finch.game.views.mode_selection.show();
	
	//test for webgl support
	var $canvas = $("<canvas></canvas>");
	$('body').append($canvas);
	var webgl_supported = $canvas.get(0).getContext("experimental-webgl");
	$canvas.remove();
	if(webgl_supported) {
		finch.game.views.battlefield_particle_effects = new views.BattlefieldParticleEffects();		
	}
	finch.game.views.battlefield_line_effects = new views.BattlefieldLineEffects();
	
	finch.game.message_box = new models.MessageBox();
	finch.game.views.message_box = new views.MessageBox({ model: finch.game.message_box });
	finch.game.views.background_music_player = new views.BackgroundMusicPlayer();
	finch.game.views.credits = new views.Credits();
});

