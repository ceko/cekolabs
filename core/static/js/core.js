// Generated by CoffeeScript 1.6.3
(function() {
  var packery_callback;

  $(function() {
    $('#top-bar .top-bar-links').menu({
      position: {
        my: 'left top',
        at: 'left+1 bottom-1'
      }
    });
    return $('#top-bar .projects').show();
  });

  packery_callback = function() {
    return $('div.post-teasers').packery({
      itemSelector: '.post-teaser-wrap'
    });
  };

  $(window).load(function() {
    $('div.post-teasers').fadeIn();
    packery_callback();
    window.exports = window.exports || {};
    return window.exports.prettify_complete = function() {
      return packery_callback();
    };
  });

}).call(this);
