({
name:"main",
css:"html,body{font-family:\"Arial\",\"Helvetica\",sans-serif;font-size:24px;background-color:#eee;margin:0;padding:0}svg{fill:red}.main{margin:10px;color:black}",
svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"24\" height=\"800\" viewBox=\"0 0 24 504\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" id=\"ic_kettle_24px\" y=\"528\"><path d=\"M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z\"/></svg><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" id=\"ic_xilo_24px\" y=\"552\"><path d=\"M11.5 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6.5-6v-5.5c0-3.07-2.13-5.64-5-6.32V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5v.68c-2.87.68-5 3.25-5 6.32V16l-2 2v1h17v-1l-2-2z\"/></svg></svg>",
mvc:new function(){
this.model=function(t){this.modelStr="Hello",t()},this.view=function(){var t=this;return{css:"main",elm:[{str:t.modelStr,elm:[{svg:"ic_kettle_24px"},{css:"world",blob:{name:"world"}}]}]}},this.controller=function(t){t()};}
})