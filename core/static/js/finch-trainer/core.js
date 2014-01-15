var finch = {}
/** backbone models **/

/** magicka button combination controls **/
var models = { controls: {} };

models.StatsOverview = Backbone.Model.extend({
	initialize: function() {
		this.set({
			games_played: 0,
			fumbles: 0,
			total_objectives: 0,
			fumble_percentage: 0,
			best_time: 0,
			worst_time: 0,
			average_time: 0
		});
	},
	update: function() {
		var round_history = finch.game.round_history.get('history');
		var games_played = 0;
		var total_objectives = 0;
		var best_time = 999999;
		var worst_time = 0;
		var average_time = 0;

		var fumbles = 0;
		var fumble_percentage = 0;
		
		for(var i=0;i<round_history.length;i++) {
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
		
		this.set({
			games_played: games_played,
			fumbles: fumbles,
			total_objectives: total_objectives,
			fumble_percentage: Math.floor(fumbles/total_objectives*100),
			best_time: best_time,
			worst_time: worst_time,
			average_time: Math.floor(average_time)
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
	initialize: function() {
		this.set({
			queued_elements: [],	
			pressed_elements: [],
			casting_power: 0,
		});
		this.keybindings = {
			'q': 'water',
			'w': 'life',
			'e': 'shield',
			'r': 'cold',
			'a': 'lightning',
			's': 'arcane',
			'd': 'earth',
			'f': 'fire'
		};
		this.incompatibility_list = [			
			['life', 'arcane'],
			['shield', 'shield'],
			['cold', 'fire'],
			['lightning', 'earth'],
			['lightning', 'water']
		];
		finch.game.views.global.on('right_mouse_press', this.handle_right_mouse_press.bind(this));
		finch.game.views.global.on('right_mouse_release', this.handle_right_mouse_release.bind(this));
		var _this = this;
		this.on('change:queued_elements', function() {
			_this.combo_parser = null;
		})
	},
	clear_queued_elements: function() {
		this.set('queued_elements', []);
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
		if(includes) {
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
	handle_right_mouse_press: function() {
		if(!this.show_cast_bar)
			return;
		
		if(this.get('queued_elements').length) {
			var combo_parser = this.get_combo_parser();
			if(combo_parser.is_instant_cast()) 
				console.log('instant cast');		
			if(combo_parser.is_channeled())
				console.log('channeled');
			if(combo_parser.is_charged())
				console.log('charged');
			combo_parser.determine_spell_type();
			console.log('spell type: ' + combo_parser.get('spell_type'));
			this.trigger('cast_start');
			if(this.combo_is_instant_cast()) {
				console.log('instant cast');
				return;
			}
				
			var _this = this;
			
			var casting_interval_function = function() {
				if(_this.combo_is_channeled()) {
					_this.trigger('spell_channeling');
					console.log('channeling');
				}
				if(_this.get('casting_power') >= 100) {
					_this.stop_casting();
					_this.set('casting_power', 0);
					return;
				}
				_this.set('casting_power', _this.get('casting_power')+10);			
			};
			
			if(this.combo_is_channeled() || this.combo_is_charged()) {
				this.casting_interval = setInterval(casting_interval_function, 200);
				casting_interval_function.call(_this);
			}else{
				this.stop_casting();
			}
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
	handle_right_mouse_release: function() {
		if(!this.show_cast_bar)
			return;		
		this.stop_casting();		
	},
	stop_casting: function() {		
		this.trigger('cast_stop');
		this.set('casting_power', 0);
		this.casting_interval = clearInterval(this.casting_interval);
		if(this.get('casting_power') > 0 || this.combo_is_instant_cast() && this.get('queued_elements').length) {
			console.log('spell cast');
			this.trigger('spell_cast', Math.min(100, this.get('casting_power')));			
		}				
		this.set('queued_elements', []);
	},
	handle_keydown: function(key) {
		if(this.casting_interval)
			return;
		var element = this.keybindings[key];
		var pressed_elements = this.get('pressed_elements');
		if(element) {
			pressed_elements[element] = true;
			this.set('pressed_elements', pressed_elements);
			this.trigger('change:pressed_elements', this, pressed_elements);
		}
	},
	handle_keyup: function(key) {
		if(this.casting_interval)
			return;
		var element = this.keybindings[key];		
		if(element) {
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
	set_cast_target: function(target) {
		this.set('cast_target', target);
	},
	get_spell_type: function() {
		if(!this.get('spell_type')) {
			this.determine_spell_type();
		}
		return this.get('spell_type');
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
			if(elements_contain('life') || elements_contain('arcane')) {
				spell_type = 'BEAM';
			}else if(elements_contain('lightning')) {
				spell_type = 'LIGHTNING';				
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
	initialize: function() {
		this.set({
			'outer_ward': null,
			'inner_ward': null,
			'shield_active': false,
			'wall_active': false
		});		
	},
	ai_step: function() {		
		this.set_starting_wards();
		this.ai_timeout = setTimeout(this.ai_step.bind(this), 1000);
	},
	set_starting_wards: function() {
		var random_ward_elements = finch.game.controls.elements.get_random_elements(includes=['shield'], excludes=['life']);
		this.set({
			'outer_ward': random_ward_elements[1],
			'inner_ward': random_ward_elements[2]
		});
		
	},
	skynet_enabled: function() {
		this.set_starting_wards();
		if(!this.ai_timeout) this.ai_timeout = setTimeout(this.ai_step.bind(this), 1000);
	}
});

models.RoundHistory = Backbone.Model.extend({
	initialize: function() {
		this.set({
			history: [],
		});
	},
	add_history: function(round_label, round_history) {		
		var history = this.get('history');
		var total_time = 0;
		for(var i=0;i<round_history.length;i++) {
			total_time += round_history[i].time_to_complete;
		}
		history.push({ 
			label: round_label,
			history: round_history,
			average_time: Math.floor(total_time / round_history.length)
		});
		this.set('history', history);
		this.trigger('change:history', this, history);
	},
	save_history: function(round_label, round_history) {
		$.ajax({
			url: '/trainer-save-history',
			type: 'POST',
			data: { label: JSON.stringify(round_label), history: JSON.stringify(round_history) }
		});		
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
	add_history: function(time_to_complete, element_queue, fumble) {		
		var history = this.get('history');		
		history.push({ 
			time_to_complete: time_to_complete,
			element_queue: element_queue,
			fumble: fumble
		});		
		this.trigger('change:history', this, history);
	}
});

/** end backbone models **/

/** views **/
var views = {};

views.Opponent = Backbone.View.extend({
	
	el: $('#opponent-slot'),
	initialize: function() {		
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.model.on('change:outer_ward', this.handle_ward_change.bind(this));
		this.model.on('change:inner_ward', this.handle_ward_change.bind(this));
	},
	handle_ward_change: function() {
		this.$el.find('.outer-ward > div').get(0).className = this.model.get('outer_ward');
		this.$el.find('.inner-ward > div').get(0).className = this.model.get('inner_ward');
	},
	render: function() {
		this.$el.html($("#opponent-template").render({ model: this.model }));
		this.center();
		return this;
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
		
		this.$el.prepend($("#round-history-template").render({ history: history[history.length-1], game_number: history.length }));		
		
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
		this.$el.disableSelection();		
		$(window).resize(this.handle_resize.bind(this));
		document.oncontextmenu = this.handle_oncontextmenu.bind(this);
	},
	handle_keydown: function(evt) {
		if(finch.game.paused) return;
		
		var key = String.fromCharCode(evt.which).toLowerCase();
		if(finch.game.controls.elements)
			finch.game.controls.elements.handle_keydown(key);				
	},	
	handle_keyup: function(evt) {
		if(finch.game.paused) return;
		
		var key = String.fromCharCode(evt.which).toLowerCase();
		if(finch.game.controls.elements)
			finch.game.controls.elements.handle_keyup(key);
	},
	handle_mousedown: function(evt) {		
		switch(evt.which) {
			case 3:
				evt.preventDefault();				
				this.trigger('right_mouse_press');
				break;
		}
	},
	handle_mouseup: function(evt) {
		switch(evt.which) {
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
	el: $('#battlefield-line-effects'),
	initialize: function() {
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.center();
		this.canvas = this.$el.get(0);
		this.context = this.canvas.getContext('2d');
		this.beam_cnt = 0;
		
		//setInterval(this.draw_lightning.bind(this), 300);
		//setInterval(this.draw_beam.bind(this), 100);
		//this.draw_lightning();
		
	},
	clear_canvas: function() {
		
		this.context.save();
		this.context.setTransform(1, 0, 0, 1, 0, 0);
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);		
		this.context.restore();
	},
	draw_beam: function() {
		
		this.clear_canvas();
		
		var origin = {
			x: this.$el.get(0).width / 2,
			y: this.$el.get(0).height			
		};
		
		var end = {
			x: this.$el.get(0).width / 2,
			y: this.$el.get(0).height / 3
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
		this.context.shadowColor='#00FF00';
		this.context.strokeStyle = '#00FF00';
		this.beam_cnt++;
		this.context.lineWidth = (this.beam_cnt % 6 > 2 ? 1 : -1) * this.beam_cnt % 3 + 10;
		console.log(this.context.lineWidth);
		draw_multipoint_line([origin, end], this.context);
	},
	draw_lightning: function() {
		this.clear_canvas();
		
		var origin = {
			x: this.$el.get(0).width / 2,
			y: this.$el.get(0).height			
		};
		
		var end = {
			x: this.$el.get(0).width / 2,
			y: this.$el.get(0).height / 3
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
		this.context.shadowBlur=10;
		this.context.shadowColor='#FFFFFF';
		this.context.strokeStyle = '#E9C1FC';
		this.context.lineWidth = 2;
		draw_multipoint_line([].concat.apply([], [[origin], twining_points, [end]]), this.context);
		draw_multipoint_line([].concat.apply([], [[origin], twining_points2, [end]]), this.context);
				
		this.context.shadowColor='#FFFFFF';
		this.context.strokeStyle = '#E9C1FC';
		this.context.lineWidth = 4;
		draw_multipoint_line([].concat.apply([], [[origin], variable_points, [end]]), this.context);
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
	initialize: function() {
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.center();
			
		var canvas = this.$el.get(0);		
		this.proton = new Proton();
		var renderer =  new Proton.Renderer('webgl', this.proton, canvas);		
		//renderer.blendFunc("SRC_ALPHA", "ONE");	
		//renderer.blendEquation('FUNC_SUBTRACT');
		renderer.start();
		this.renderer = renderer;
		
		requestAnimationFrame(this.render_loop.bind(this));
		finch.game.controls.elements.on('cast_start', this.handle_cast_start.bind(this));
		finch.game.controls.elements.on('cast_stop', this.handle_cast_stop.bind(this));
		
		this.render_explosion_at('center', 300);
		
		//var fire_emitter = this.get_fire_emitter();
		//fire_emitter.emit();
		//this.proton.addEmitter(fire_emitter);
		
		//var water_emitter = this.get_water_emitter();
		//water_emitter.emit();
		//this.proton.addEmitter(water_emitter);
			
		//var frost_emitter = this.get_frost_emitter();
		//frost_emitter.emit();
		//this.proton.addEmitter(frost_emitter);
		
		/*var _this = this;
								
		setInterval(function() {
			for(i=0;i<3;i++) {
				var shard_emitter = _this.get_shard_emitter();
				shard_emitter.emit(1, 2);
				_this.proton.addEmitter(shard_emitter);
								
			}
		}, 2000);
		*/
		
		
		
	},
	cancel_on_stopcast: function(emitter) {
		this.emitters_queued_to_cancel.push(emitter);
	},
	handle_cast_start: function() {
		var combo_parser = finch.game.controls.elements.get_combo_parser();
		var elements = finch.game.controls.elements.get('queued_elements');
			
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
				this.proton.addEmitter(emitter);
				this.cancel_on_stopcast(emitter);							
		}
	},
	handle_cast_stop: function() {
		for(i=0;i<this.emitters_queued_to_cancel.length;i++) {
			this.emitters_queued_to_cancel[i].stopEmit();
		}
		
		var combo_parser = finch.game.controls.elements.get_combo_parser();
		var elements = finch.game.controls.elements.get('queued_elements');
		var collision_emitter_bounds = null;
		var collision_callback = null;
		var emitter_movespeed = 0;
		
		switch(combo_parser.get_spell_type()) {
			case 'ICE_SHARDS':
				for(i=0;i<3;i++) {
					var emitter = this.get_shard_emitter();
					emitter.emit(1,2);
					this.proton.addEmitter(emitter);
				}
			case 'ROCK_PROJECTILE':
				if($.inArray('fire', elements) !== -1) {
					var emitter = this.get_fireball_emitter();
					collision_emitter = emitter;
					collision_emitter_bounds = -300; /* i think this is relative from where the emitter starts */
					emitter.emit();
					emitter_movespeed = 1;
					this.proton.addEmitter(emitter);
					collision_callback = (function() { this.render_explosion_at('center', this.$el.get(0).height + collision_emitter_bounds); }).bind(this);
				}
		}
		
		if(collision_emitter_bounds && emitter_movespeed) {
			var last_timestamp = null
			var move_emitter = function(timestamp) {								
					if(last_timestamp) {
						emitter.p.y = emitter.p.y - (timestamp - last_timestamp)*emitter_movespeed;					
					}
					if(emitter.p.y <= collision_emitter_bounds) {
						emitter.stopEmit();
						if(collision_callback) {
							collision_callback();
						}
						return;
					}					
					last_timestamp = timestamp;
				
				requestAnimationFrame(move_emitter);
			}
			move_emitter();
		}
	},
	render_loop: function() {
		requestAnimationFrame(this.render_loop.bind(this));
		this.proton.update();
	},
	render_explosion_at: function(x, y) {
		if(x == 'center') {
			x = this.$el.get(0).width / 2;
		}
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(85, 100), .1);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(x, y+50, 1)));
		emitter.addInitialize(new Proton.Life(.5, 1));
		emitter.addInitialize(new Proton.ImageTarget(['/static/images/finch/particle.png'], 32));
		emitter.addInitialize(new Proton.Radius(20));
		emitter.addInitialize(new Proton.V(new Proton.Span(4, 5), new Proton.Span(0, 360), 'polar'));
		emitter.addBehaviour(new Proton.Alpha(1, 0));
		emitter.addBehaviour(new Proton.Color('#ff0000', '#ffff00'));
		emitter.addBehaviour(new Proton.Scale(Proton.getSpan(0.3, 4), 0));
		
		emitter.emit('once');
		
		this.proton.addEmitter(emitter);		
	},
	get_fireball_emitter: function() {
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 8), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 1)));		
		emitter.addInitialize(new Proton.Life(.2, .3));
		emitter.addInitialize(new Proton.V(new Proton.Span(-2, -3), new Proton.Span(180, 35, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#ff0000', '#ffff00'));
		emitter.addBehaviour(new Proton.Scale(1, .2));
		emitter.addBehaviour(new Proton.Alpha(1, .2));
		
		return emitter;
	},
	get_shard_emitter: function() {		
		var emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(5, 10), .01);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 0)));
		emitter.addInitialize(new Proton.Life(1, 1));
		emitter.addInitialize(new Proton.V(new Proton.Span(1, 3), new Proton.Span(180, .1, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#FFFFEF', '#FFFFEE'));
		emitter.addBehaviour(new Proton.Scale(.4, .2));
		emitter.addBehaviour(new Proton.Alpha(1, 0));		
		
		var drift = (Math.floor(Math.random()*8)+1) - 4;
		var last_timestamp = null
		var move_emitter = function(timestamp) {
			if(last_timestamp) {
				emitter.p.y = emitter.p.y - (timestamp - last_timestamp);	
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
		emitter.addInitialize(new Proton.Life(1, 1.5));
		emitter.addInitialize(new Proton.V(new Proton.Span(3, 4), new Proton.Span(0, 25, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#ff0000', '#ffff00'));

		emitter.addBehaviour(new Proton.Scale(1.3, .2));
		emitter.addBehaviour(new Proton.Alpha(1, .2));
		
		return emitter;
	},
	get_cold_emitter: function() {
		emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(25, 55), .1);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 10)));
		emitter.addInitialize(new Proton.Life(.5, 2));
		emitter.addInitialize(new Proton.V(new Proton.Span(3.8, 4), new Proton.Span(0, 25, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#FFFFEF', '#FFFFEE'));

		emitter.addBehaviour(new Proton.Scale(2, 0));
		emitter.addBehaviour(new Proton.Alpha(1, .3));
		
		return emitter;
	},
	get_water_emitter: function() {
		emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(25, 30), .10);
		emitter.addInitialize(new Proton.Mass(1));
		emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));
		//emitter.addInitialize(new Proton.InitialColor('#1D1D83'));
		emitter.addInitialize(new Proton.Position(new Proton.CircleZone(this.$el.get(0).width / 2, this.$el.get(0).height + 20, 10)));
		emitter.addInitialize(new Proton.Life(2, 3.2));
		emitter.addInitialize(new Proton.V(new Proton.Span(5, 5.5), new Proton.Span(0, 20, true), 'polar'));
		emitter.addBehaviour(new Proton.Color('#0003EE', '#0000CC'));
		emitter.addBehaviour(new Proton.Gravity(5));
		
		emitter.addBehaviour(new Proton.Scale(2.0, 0));
		emitter.addBehaviour(new Proton.Alpha(1, 1));
		
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
		'click .dequeue-mode': 'start_dequeue_game',
		'click .queue-mode': 'start_queue_game',
		'click .offensive-mode': 'show_offensive_instructions',
		'change #round-length': 'change_round_length'		
	},
	
	initialize: function() {
		$('#round-length').val(finch.game.round_length);
		$('#cancel-game').click(this.cancel_game.bind(this));
		this.countdown_timer = null;
		finch.game.views.global.on('smart_resize', this.center.bind(this));
		this.view_stack.push(this.$el);
	},
	
	change_round_length: function() {
		finch.game.round_length = parseInt($('#round-length').val());
	},
	
	cancel_game: function() {
		finch.game.pause();
		if(finch.game.controls.elements)
			finch.game.controls.elements.clear_queued_elements();				
		finch.game.views.mode_selection.show();	
		if(finch.game.objective_history) {
			finch.game.objective_history.clear();
			finch.game.views.objective_history.hide();
		}
		if(finch.game.views.queued_elements)
			finch.game.views.queued_elements.hide()
		if(finch.game.views.queued_elements_helper)
			finch.game.views.queued_elements_helper.hide()
		this.countdown_timer = clearTimeout(this.countdown_timer);
		$('.countdown').remove();
	},
	
	show_offensive_instructions: function() {
		var $instructions =$($('#offensive-mode-instructions').render().trim());
		$('#battlefield').append($instructions);
		this.push_window($instructions);		
		$instructions.find('.start-button').click(this.start_offensive_game.bind(this));
		
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
			_this.center(animate=true);
			$popped_window.remove();
		});
	},
	
	start_offensive_game: function() {
		var callback = function() {
			finch.game.set_mode('offensive');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.set_top_padding(230);
			finch.game.views.queued_elements.show()
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
			finch.game.set_mode('queue');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.show()
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.fadeOut('fast');				
		this.set_game_mode_text('Queue Shown Elements');
	},
	
	start_dequeue_game: function() {
		var callback = function() {
			finch.game.set_mode('dequeue');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.show();
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.fadeOut('fast');		
		this.set_game_mode_text('Cancel Queued Elements');
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
			
			this.countdown_timer = setTimeout(function() {
				if(cnt==1) {
					if(_this.countdown_timer) callback();
					$countdown_original.remove();
				}else{
					if(_this.countdown_timer) advance_countdown(cnt-1);
				}
			}, 1000);
			
		};
		
		this.countdown_timer = setTimeout(function() { advance_countdown(1); }, 1);
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
	
	center: function(animate) {
		var $window = this.view_stack[this.view_stack.length-1];
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
	el: $('#elements-controls'),
				
	initialize: function() {
		this.model.on("change:pressed_elements", this.handle_pressed_elements.bind(this));		
	},
	
	handle_pressed_elements: function(model, pressed_elements) {		
		this.$el.find('.pressed').removeClass('pressed');
		var _this = this;
		for(var element in pressed_elements) {		
			this.$el.find('.' + element).addClass('pressed');
		}
	},
	
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
		if(this.model.show_cast_bar) {
			this.$el.find('.cast-bar').show();
		}
		if(power == 0) {
			this.$el.find('.cast-bar').hide();
		}
		this.$el.find('.cast-bar div').animate({ width: power + '%' }, 200, 'linear');
	},
	
	handle_queued_elements: function(model, queued_elements) {
		this.render();		
	},
	
	handle_element_fizzle: function(model, element_index, requested_element) {
		var $fizzled_element = $(this.$el.find('div').get(element_index));
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
			clearTimeout(this.hide_timeout);
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
	round_length: 5,
	statebag: {},
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
						
			finch.game.views.elements = new views.Elements({ suppress_fizzle: true, model:finch.game.controls.elements });
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
				
				switch(finch.game.statebag.mode) {
					case 'dequeue':
						if(queued_elements.length == 0) {
							var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
							var fumble = finch.game.statebag.objective_keypresses > 3;
							
							finch.game.objective_history.add_history(elapsed_time, finch.game.last_objective, fumble);
							if(finch.game.objective_history.get('history').length < finch.game.round_length)
								finch.game.load_next_objective();
						}
						break;
					case 'queue':
						if(finch.game.controls.elements_helper.matches_elements(queued_elements)) {
							var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
							var fumble = finch.game.statebag.objective_keypresses > 3;
							finch.game.controls.elements.clear_queued_elements();
							
							finch.game.objective_history.add_history(elapsed_time, queued_elements, fumble);
							if(finch.game.objective_history.get('history').length < finch.game.round_length)
								finch.game.load_next_objective();
						}
				}				
			});
			finch.game.objective_history.on("change:history", function(model, history) {
				if(history.length === finch.game.round_length) {
					finch.game.pause();
					finch.game.controls.elements.clear_queued_elements();				
					finch.game.views.mode_selection.show();
					finch.game.views.objective_history.transition_to_round_history(function() {
						finch.game.round_history.add_history(finch.game.statebag.mode, history);
						finch.game.round_history.save_history(finch.game.statebag.mode, history);
						finch.game.stats_overview.update();
						finch.game.objective_history.clear();
					});
					finch.game.views.queued_elements.hide()
					finch.game.views.queued_elements_helper.hide()
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
		switch(finch.game.statebag.mode) {
			case 'dequeue': 
				this.load_dequeue_objective();
				break;
			case 'queue':
				this.load_queue_objective();
				break;
			case 'offensive':
				this.load_offensive_objective();
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
	}
};
finch.game.controls = {		
	elements: new models.controls.Elements(),
	elements_helper: new models.controls.Elements({ ignore_keystrokes: true }),		
}

$(function() {
	/* proton custom code */
	(function(Proton, undefined) {
	    function InitialColor(color) {
	            InitialColor._super_.call(this);
	            this.initial_color = Proton.Util.hexToRGB(color);
	    }

	    Proton.Util.inherits(InitialColor, Proton.Initialize);
	    InitialColor.prototype.initialize = function(particle) {
	    		particle.transform.rgb.r = this.initial_color.r;
	    		particle.transform.rgb.g = this.initial_color.g;
	    		particle.transform.rgb.b = this.initial_color.b;
	            //particle.color = new Proton.ColorSpan(this.initial_color);
	    };

	    Proton.InitialColor = InitialColor;
	})(Proton);
	/* end proton custmo code */
	
	
	finch.game.views.mode_selection = new views.ModeSelection();
	finch.game.stats_overview = new models.StatsOverview();
	finch.game.views.stats_overview = new views.StatsOverview({ model: finch.game.stats_overview });
	finch.game.views.stats_overview.render();
	finch.game.views.mode_selection.show();
	finch.game.views.battlefield_particle_effects = new views.BattlefieldParticleEffects();
	finch.game.views.battlefield_line_effects = new views.BattlefieldLineEffects();
	finch.game.views.mode_selection.start_offensive_game();
});
