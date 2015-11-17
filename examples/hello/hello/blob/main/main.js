(function(){return{
	m: function (next) {
		this.modelStr = "Hello"
	},

	v: function () {
    var self = this;
    return {
      str: self.modelStr
    }
  },

	c: function (next) {
		next();
	}
}})()
