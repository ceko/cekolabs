$ ->
	$('#top-bar .top-bar-links').menu(
		position:	
			my: 'left top',
			at: 'left+1 bottom-1'		
	)
	$('#top-bar .projects').show()
	

isotope_callback = ->
	$('#post-teasers').isotope 	  
		itemSelector: '.post-teaser',
	  	layoutMode: 'fitRows'
	  	
$(window).load ->
	$('#post-teasers').fadeIn()
	isotope_callback()
	
	  	
$(window).resize -> isotope_callback()
	
	
		