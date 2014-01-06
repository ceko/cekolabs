
var finch = {}
finch.game = {		
	//starts a new game, usually called immediately after loading the page.
	start: function() {
		//create all uninitialized models
		finch.game.controls = {
			elements: new models.controls.Elements()
		};		
		finch.game.objective_history = new models.ObjectiveHistory();
		
		finch.game.views.global = new views.Global();
		finch.game.views.elements = new views.Elements({ suppress_fizzle: true, model:finch.game.controls.elements });
		finch.game.views.queued_elements = new views.QueuedElements({ model:finch.game.controls.elements });
		finch.game.views.objective_history = new views.ObjectiveHistory({ model:finch.game.objective_history });
		
		finch.game.load_next_objective();
		finch.game.controls.elements.on("change:queued_elements", function(model, queued_elements) {
			if(finch.game.loading_next_objective)
				return;
			
			if(queued_elements.length == 0) {
				var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;				
				finch.game.objective_history.add_history(elapsed_time, finch.game.last_objective);				
				finch.game.load_next_objective();
			}
		});
	},
	views: {},
	controls: {},
	load_next_objective: function() {
		finch.game.loading_next_objective = true;
		finch.game.last_objective_start_time = (new Date()).getTime();
		finch.game.controls.elements.queue_random_elements();
		finch.game.last_objective = finch.game.controls.elements.get('queued_elements').slice(0);
		finch.game.loading_next_objective = false;
	}
}

/** backbone models **/

/** magicka button combination controls **/
var models = { controls: {} };

models.controls.Elements = Backbone.Model.extend({
	suppress_fizzle: false,
	initialize: function() {
		this.set({
			queued_elements: [],	
			pressed_elements: [],
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
	},
	clear_queued_elements: function() {
		this.set('queued_elements', []);
	},
	queue_random_elements: function() {
		this.suppress_fizzle = true;
		this.clear_queued_elements();		
		while(this.get('queued_elements').length < 3) {
			var keybinding_index = Math.floor(Math.random()*8);
			var cnt = 0;
			var proposed_keypress = null;
			for(key in this.keybindings) {
				if(this.keybindings.hasOwnProperty(key)) {
					if(cnt == keybinding_index) {
						proposed_keypress = key
						break;
					}
						
					cnt++;
				}			
			}
			
			this.handle_keyup(proposed_keypress);
		}
		this.suppress_fizzle = false;
	},
	handle_keydown: function(key) {
		var element = this.keybindings[key];
		var pressed_elements = this.get('pressed_elements');
		if(element) {
			pressed_elements[element] = true;
			this.set('pressed_elements', pressed_elements);
			this.trigger('change:pressed_elements', this, pressed_elements);
		}
	},
	handle_keyup: function(key) {
		var element = this.keybindings[key];		
		if(element) {
			if(!this.requested_element_incompatible(element)) {			
				var queued_elements = this.get('queued_elements');
				if(queued_elements.length < 3) {
					queued_elements.push(element);
					this.set('queued_elements', queued_elements);
					this.trigger('change:queued_elements', this, queued_elements);
				}								
			}
			
			var pressed_elements = this.get('pressed_elements');
			delete pressed_elements[element];
			this.set('pressed_elements', pressed_elements);
			this.trigger('change:pressed_elements', this, pressed_elements);
		}
	},
	requested_element_incompatible: function(element) {
		var queued_elements = this.get('queued_elements');		
		//iterate through incompatibility list
		for(i=0;i<this.incompatibility_list.length;i++) {
			var check_set = this.incompatibility_list[i];
			//iterate through specific incompatibility
			for(j=0;j<check_set.length;j++) {
				//this element is in the list, check queued elements from last to first
				if(check_set[j] == element) {
					var found_at = j; //skip this when checking queued.
					for(k=0;k<check_set.length;k++) {
						if(k != found_at) {
							var incompatibility_index = queued_elements.lastIndexOf(check_set[k]);
							if(incompatibility_index !== -1) {
								if(!this.suppress_fizzle)
									this.trigger('element_fizzle', this, incompatibility_index, element);
								
								queued_elements.splice(incompatibility_index, 1);
								this.set('queued_elements', queued_elements);
								this.trigger('change:queued_elements', this, queued_elements);
								return true;
							}
						}
					}					
				}
			}
		}
	}
});

models.ObjectiveHistory = Backbone.Model.extend({	
	initialize: function() {
		this.set({
			history: [],
		});
	},
	add_history: function(time_to_complete, element_queue) {		
		var history = this.get('history');
		history.push({ 
			time_to_complete: time_to_complete,
			element_queue: element_queue,
		});
		this.trigger('change:history', this, history);
	}
});

/** end backbone models **/

/** views **/
var views = {};

views.ObjectiveHistory = Backbone.View.extend({
	
	tagName: 'div',
	id: 'objective-history',
	
	initialize: function() {	
		this.model.on("change:history", this.handle_history_change.bind(this));	
		this.already_rendered = false;
	},
	
	handle_history_change: function(model, history) {
		this.render();		
	},
	
	render: function() {				
		var history = this.model.get('history');		
		this.$el.html($("#history-template").render({ history: history }));
			
		//first time rendering position it in the middle of the playing field.
		if(!this.already_rendered) {
			this.already_rendered = true;		
			var $battlefield = $('#battlefield');
			$battlefield.append(this.$el);
			//position it in the middle of the battlefield by default, it can get moved though
			this.$el.css({
				top: ($battlefield.outerHeight() / 2 - this.$el.outerHeight() / 2) + 90,
				left: $battlefield.outerWidth() / 2 - this.$el.outerWidth() / 2,
			});
		}
		
		return this;		
	}
	
});

views.Global = Backbone.View.extend({
	el: $('body'),
	events: {
		'keydown': 'handle_keydown',
		'keyup': 'handle_keyup'
	},
	initialize: function() {
		this.$el.disableSelection();
	},
	handle_keydown: function(evt) {
		var key = String.fromCharCode(evt.which).toLowerCase();
		finch.game.controls.elements.handle_keydown(key);				
	},
	
	handle_keyup: function(evt) {
		var key = String.fromCharCode(evt.which).toLowerCase();
		finch.game.controls.elements.handle_keyup(key);
	},
});

views.Instructions = Backbone.View.extend({
	el: $('#instructions'),
	events: {
		'click #start-game': 'start_game'
	},
	
	start_game: function() {
		this.$el.fadeOut('fast');
		finch.game.start();
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
	id: 'element-queue',
	hide_timeout: null,
	auto_fadeout: true,
	
	initialize: function() {	
		this.model.on("change:queued_elements", this.handle_queued_elements.bind(this));
		this.model.on("element_fizzle", this.handle_element_fizzle.bind(this));
		this.already_rendered = false;
	},
	
	handle_queued_elements: function(model, queued_elements) {
		this.render();
		//add unknown elements
	},
	
	handle_element_fizzle: function(model, element_index, requested_element) {
		var $fizzled_element = $(this.$el.find('div').get(element_index));
		var $clone = $fizzled_element.clone();
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
		$requested.attr('class', requested_element + ' fizzling').appendTo('body').effect('shake', 400, function() {
			$(this).remove();
		});
		
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
		
		//first time rendering position it in the middle of the playing field.
		if(!this.already_rendered) {
			this.already_rendered = true;		
			var $battlefield = $('#battlefield');
			$battlefield.append(this.$el);
			//position it in the middle of the battlefield by default, it can get moved though
			this.$el.css({
				top: $battlefield.outerHeight() / 2 - this.$el.outerHeight() / 2,
				left: $battlefield.outerWidth() / 2 - this.$el.outerWidth() / 2 - 7 /** 15 pixels padding **/,
			});
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
		
	}


});
/** end views **/

/** particle effects **/

/** end particle effects **/

finch.game.views.instructions = new views.Instructions();
