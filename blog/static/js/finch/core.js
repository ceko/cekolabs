
var finch = {}
finch.game = {		
	//starts a new game, usually called immediately after loading the page.
	start: function() {
		//create all uninitialized models
		finch.game.controls = {
			elements: new models.controls.Elements()
		};
		finch.game.hand = new models.Hand();
		finch.game.views = {
			global: new views.Global(),
			elements: new views.Elements({ model:finch.game.controls.elements }),
			queued_elements: new views.QueuedElements({ model:finch.game.controls.elements }),
			hand: new views.Hand({ model: finch.game.hand }),
			hero_summon_points: [
			     new views.SummonPoint({ model: new models.SummonPoint(), el: $('#hero-side .summon-point:eq(0)') }),
			     new views.SummonPoint({ model: new models.SummonPoint(), el: $('#hero-side .summon-point:eq(1)') }),
			     new views.SummonPoint({ model: new models.SummonPoint(), el: $('#hero-side .summon-point:eq(2)') }),
			     new views.SummonPoint({ model: new models.SummonPoint(), el: $('#hero-side .summon-point:eq(3)') })
			]
		};		
		
		//testing, add a couple cards.
		finch.game.hand.draw_card();
		finch.game.hand.draw_card();
		finch.game.hand.draw_card();
	}
}

/** backbone models **/

/** magicka button combination controls **/
var models = { controls: {} };

models.Card = Backbone.Model.extend({
	initialize: function() {
		this.set({
			type: null,
			title: null,
			description: null,
			attributes: [],
			requirements: [],
		});
	},
	
	requirements_met: function() {
		var unused_queued_elements = finch.game.controls.elements.get('queued_elements').slice(0); //clone?
		var requirements = this.get('requirements');
		var met_requirements = [];
		
		for(i=0;i<requirements.length;i++) {
			switch(requirements[i].type) {
				case 'element':
					var required_element = requirements[i].element;
					for(var j in unused_queued_elements) {
						if(unused_queued_elements[j] == required_element) {
							met_requirements.push(requirements[i]);
							unused_queued_elements.splice(j,1);
							break;
						}
					}
					break;
			}			
		}
		
		return met_requirements.length == requirements.length;
	}
}),

models.controls.Elements = Backbone.Model.extend({
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

models.Hand = Backbone.Model.extend({
	
	initialize: function() {
		this.set({
			cards: [],
		})
	},
	
	remove_card: function(card_model) {
		var cards = this.get('cards');
		for(i=0;i<cards.length;i++) {
			if(cards[i] == card_model) {
				cards.splice(i,1);
				this.set('cards', cards);
				this.trigger('change:cards', this, card_model, 'remove');
				
				finch.game.hand.draw_card();				
				break;
			}
		}				
	},
	
	draw_card: function() {
		var card_model = new models.Card();
		var card_definition = finch.card_definitions[Math.floor((Math.random()*finch.card_definitions.length))]; 
		card_model.set('type', card_definition.type);
		card_model.set('title', card_definition.title);
		card_model.set('description', card_definition.description);
		card_model.set('attributes', card_definition.attributes);
		card_model.set('requirements', card_definition.requirements);
		
		var card_view = new views.Card({ model:card_model });
		card_model.view = card_view;
		card_view.render();
				
		var cards = this.get('cards');
		cards.push(card_model);
		this.set('cards', cards);
		this.trigger('change:cards', this, card_model, 'add');
	}
	
});

models.SummonPoint = Backbone.Model.extend({
	
	initialize: function() {
		this.set({
			active: true,
			cards: []
		});
	},
	
	add_card: function(card_model) {
		//can accept three types of cards, a wall/shield, a unit, and a ward.
		//if this is called don't bother checking if it's valid, just add it to the card array.
		//checks happen before
		switch(card_model.get('type')) {
			case 'defensive':
				this.set('shield', card_model);
				break;
		}
		
		var cards = this.get('cards');
		cards.push(card_model);
		this.set('cards', cards);
		this.trigger('change:cards', this, card_model, 'add');
	}
	
});

/** end backbone models **/

/** views **/
var views = {};
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

views.Elements = Backbone.View.extend({
	el: $('#elements-controls'),
	/*events: {		
		'click .water': 'handle_input',
	},*/
			
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

views.Card = Backbone.View.extend({
	
	tagName: 'div',
	className: 'card-wrapper',
	
	initialize: function() {
		finch.game.controls.elements.on("change:queued_elements", this.handle_queued_elements.bind(this));
		this.draggable_initialized = false;
		this.$el.data('view', this);
		this.summoned = false;
	},
	
	handle_summoned: function() {
		finch.game.hand.remove_card(this.model);
		finch.game.controls.elements.clear_queued_elements();
		
		this.$el.remove();
		this.summoned = true;		
	},
	
	handle_queued_elements: function(model, queued_elements) {		
		this.$el.find(".requirements > div").removeClass('fulfilled');
		for(var index in queued_elements) {
			var element = queued_elements[index];
			this.$el.find(".requirements div." + element).not('.fulfilled').first().addClass('fulfilled');
		}
		if(this.model.requirements_met()) {							
			this.$el.find('.card').addClass('requirements-met');			
			var _this = this;
			this.$el.draggable({
				helper: 'clone',
				appendTo: 'body',
				containment: '#playing-field',
				start: function() {
					$(this).hide();
				},
				stop: function() {
					if(!_this.summoned) $(this).show(); //if we need to revert, else remove.
				}
			});
			this.draggable_initialized = true;			
			this.$el.draggable('enable');
		}else{
			this.$el.find('.card').removeClass('requirements-met');
			if(this.draggable_initialized &&!this.summoned)
				this.$el.draggable('disable');
		}
	},
	
	render: function() {
		this.$el.html($("#card-template").render({ 
			type: this.model.get('type'),
			title: this.model.get('title'),
			description: this.model.get('description'),
			attributes: this.model.get('attributes'),
			requirements: this.model.get('requirements')
		}));
		return this;
	}
	
});

views.Hand = Backbone.View.extend({
	
	el: $('#card-draw-area'),
	
	initialize: function() {
		this.model.on('change:cards', this.handle_cards_change.bind(this))
	},
	
	handle_cards_change: function(model, card_model, action /*add or delete*/) {
		//go through cards in the hand and lay them out properly
		if(action == 'add')
			this.$el.append(card_model.view.$el);
		
		var all_cards = model.get('cards');
		for(i=0;i<all_cards.length;i++) {
			all_cards[i].view.$el.animate({
				left: i*200+20,				
			});
		}
	}
	
});

views.SummonPoint = Backbone.View.extend({
	
	initialize: function() {
		this.model.view = this; //should probably make this a standard.
		var _this = this;
		this.$el.droppable({
			accept: ".card-wrapper",
			hoverClass: "ui-state-active",
			drop: function( event, ui ) {
				_this.model.add_card(ui.draggable.data().view.model);
				//the next line removes the model variable from view.
				ui.draggable.data().view.handle_summoned(this.model);				
			}
		});
		this.model.on("change:cards", this.handle_cards_changed.bind(this));
	},
	
	handle_cards_changed: function() {
		this.render();
	},
	
	render: function() {
		//render units
		//render shields
		//render wards
		
		var shield = this.model.get('shield');
		this.$el.html($("#summon-point-template").render({ shield: shield }));
	}

});

views.QueuedElements = Backbone.View.extend({

	tagName: 'div',
	id: 'element-queue',
	hide_timeout: null,
	
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
			this.hide_timeout = setTimeout((function() { this.$el.fadeOut(); }).bind(this), 5000 );
		}else{
			this.$el.show();
			clearTimeout(this.hide_timeout);
		}
		return this;
		
	}


});
/** end views **/

//card definitions, goes last because it's long and i don't want to scroll past it every time i change something
finch.card_definitions = [
	{
		type: 'defensive',
		title: 'Fiery Rock Wall',
		description: 'A powerful rock wall that does AoE damage when destroyed.',
		attributes: [
		   {
			   type: 'attack',
			   value: 2			   
		   },
		   {
			   type: 'health',
			   value: 3
		   }
		],
		requirements: [
		   {
			   type: 'element',
			   element: 'shield'
		   },
		   {
			   type: 'element',
			   element: 'earth'
		   },
		   {
			   type: 'element',
			   element: 'fire'
		   },
		]
	},
	{
		type: 'defensive',
		title: 'Strong Rock Wall',
		description: 'A purely defensive wall good against physical attacks.',
		attributes: [
		   {
			   type: 'health',
			   value: 5			   
		   }
		],
		requirements: [
		   {
			   type: 'element',
			   element: 'shield'
		   },
		   {
			   type: 'element',
			   element: 'earth'
		   },
		   {
			   type: 'element',
			   element: 'earth'
		   },
	  	]
	},
	{
		type: 'lightning-aoe',
		title: 'Arcane Storm',
		description: 'Does AoE lightning & arcane damage to all enemies on the field.',
		attributes: [		            
		   {
			   type: 'attack',
			   value: 3			   
		   }
		],
		requirements: [
		   {
			   type: 'element',
			   element: 'lightning'
		   },
		   {
			   type: 'element',
			   element: 'arcane'
		   },
		   {
			   type: 'element',
			   element: 'shield'
		   },
	  	]
	}
];

finch.game.start();