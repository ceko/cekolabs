
$ -> 
	$('#tag-list .tag-list-expander').click (evt) -> 
		$this = $(this)
		if $this.hasClass('expanded')
			$this.siblings('.hidden-tags').slideUp()
			$this.removeClass('expanded')
		else
			$this.siblings('.hidden-tags').slideDown()
			$this.addClass('expanded')