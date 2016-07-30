$(document).ready(function(){
	$('<div class="eventSelector" id="eventSelector1"></div>').appendTo('#eventSelectors').MPEventSelect()
	$('#dateRange').MPDatepicker();
	var totalEvents = 1;
	$('#add').click(function(){
		if ($('#eventSelector' + totalEvents).val() != null){
			totalEvents++;
			$('<div class= "right-arrow"></div>').appendTo('#eventSelectors')
			$('<div class="eventSelector" id="eventSelector'+ totalEvents +'"></div>').appendTo('#eventSelectors').MPEventSelect();
		}
	});
	$('#run').click(function(){
		var steps = [];
		_.each($('#eventSelectors').children(), function(child){
			if ($("#"+child.id).val() != null){
				steps.push($("#"+child.id).val());
			}
		})
		buildFunnel(steps)
	})
})

function strictOrderTables(params) {
	MP.api.jql(
		function main() {
		  return Events({
		    from_date: params.from_date,
		    to_date:   params.to_date
		  })
		  .groupByUser(function(state, events){
		    var result = state || [];
		    _.each(events, function(event){
		      if (event.name == params.event && result.length < 2){
		        if (result.length === 0){
		          result.push("Direct");
		        }
		        result.push(event.name);
		      } else if (result.length < 2) {
		        result = [event.name];
		      }
		    });
		    return result;
		  })
		  .filter(function(user){return user.value.length == 2})
		  .reduce(function(accumulators, users){
		    var result = {};
		    _.each(users, function(user){
		      result[user.value[0]] = result[user.value[0]] || 0;
		      result[user.value[0]]++;
		    });
		    _.each(accumulators, function(accumulator){
		      _.each(accumulator, function(value, key){
		        result[key] = result[key] || 0;
		        result[key] += value;
		      });
		    });
		    return result;
		  });
		}, 
		params
	).done(function(data){
		var before_data = topTwelve(data[0]);
		MP.api.jql(function main() {
			  return Events({
			    from_date: params.from_date,
			    to_date: params.to_date
			  })
			  .groupByUser(function(state, events){
			    var result = state || {stage:0, next_event:"Bounced"};
			    _.each(events, function(event){
			      if (result.stage == params.steps.length && result.next_event == "Bounced"){
			        result.next_event = event.name;
			      }else if(event.name == params.steps[result.stage]){
			        result.stage++;
			      }
			    });
			    return result;
			  })
			  .filter(function(user){return user.value.stage == params.steps.length})
			  .reduce(function(accumulators, users){
			    var result = {};
			    _.each(users, function(user){
			      result[user.value.next_event] = result[user.value.next_event] || 0;
			      result[user.value.next_event]++;
			    });
			    _.each(accumulators, function(accumulator){
			      _.each(accumulator, function(value, key){
			        result[key] = result[key] || 0;
			        result[key] += value;
			      });
			    });
			    return result;
			  });
			},
			params
		).done(function(data){
			$('#tables').empty();
			$('<table id="before"></table>').appendTo('#tables')
			$('<div class="table_description">Event Completed Immediately Before</div>').appendTo('#before')
			_.each(before_data, function(value){
				$('<tr><td class="table_event before_event">'+value.event_name+'</td><td>'+value.value+'</td></tr>').appendTo('#before')
			})
			var after_data = topTwelve(data[0])
			$('<table id="after"></table>').appendTo('#tables')
			$('<div class="table_description">Event Completed Immediately After</div>').appendTo('#after')
			_.each(after_data, function(value){
				$('<tr><td class="table_event after_event">'+value.event_name+'</td><td>'+value.value+'</td></tr>').appendTo('#after')
			})
			$('.table_event').hover(function(){$(this).css({"color":"#59aae9", "cursor":"pointer"})}, function(){$(this).css({"color":"#3f516b"})})
			$('.before_event').click(function(){
				if ($(this).text() != "Direct"){
					var steps = findSteps();
					var new_steps = [$(this).text()]
					_.each(steps.slice($(".selected").attr("value")-1, steps.length), function(step){
						new_steps.push(step)
					})
					buildEventSelectors(new_steps);
					buildFunnel(new_steps);
				}
			})
			$('.after_event').click(function(){
				if ($(this).text() != "Bounced"){
					var steps = findSteps();
					var new_steps = steps.slice(0,$(".selected").attr("value"));
					new_steps.push($(this).text());
					buildEventSelectors(new_steps);
					buildFunnel(new_steps);
				}
			})
		})
	})
}

function findSteps(){
	var steps = []
	_.each($("#steps").children(), function(div){
		if ($(div).attr("value")){
			steps.push($("#eventSelector" + $(div).attr("value")).val())
		}
	})
	return steps
}

function topTwelve(data){
	var top_events = []
	for (var i=0; i < 12; i++){
		if (_.keys(data).length > 0){
			var max = {}
			var max_key = _.invert(data)[_.max(data, function(key){return key})]	
			max.event_name = max_key
			max.value = data[max_key]
			top_events.push(max)
			delete data[max_key]
		}
	}
	return top_events
}

function buildEventSelectors(steps){
	var x = 1;
	$('#eventSelectors').empty();
	_.each(steps, function(step){
		$('<div class="eventSelector" id="eventSelector'+ x +'"></div>').appendTo('#eventSelectors').MPEventSelect();
		x++
	})
	x = 1
	_.each(steps, function(step){
		stepValue(x, step)
		x++
	})
}

function stepValue(step, event_name){
	setTimeout(function(){
		if ($("#eventSelector" + step).text() != "Loading...") {
			$("#eventSelector" + step).val(event_name)
		} else {
			stepValue(step, event_name)
		}
	}, 10)
}

function buildFunnel(steps) {
	var x = 1;
	var count = 0;
	var toDate = $('#dateRange').val().to
	var fromDate = $('#dateRange').val().from
	var interval = moment(toDate).diff(moment(fromDate), 'days') + 1
	var params = {
		from:moment($('#dateRange').val().from),
		to:moment($('#dateRange').val().to),
		limit: 100,                             // maximum number of results to return
		length: 30,
		interval:interval,
	};
	steps.push(params);
	$('#tables').empty();
	MP.api.funnel.apply(MP.api, steps).done(function(data){
		$("#steps").empty()
		$("#reportBody").addClass("mixpanel-platform-section")
		$("#reportBody").css({"min-height":"500px"})
		_.each(data, function(step){
			if (count > 0){
				var conversion = ((step[moment(fromDate).format('YYYY-MM-DD')].count / count)*100).toFixed(2);
				if (conversion == 100.00){
					conversion = (100.0).toFixed(1);
				}
				$('<div class="percentage"><div class="percentageText">'+ conversion +'%</div></div>').appendTo("#steps");
			}
			count = step[moment(fromDate).format('YYYY-MM-DD')].count;
			var eventName = step[moment(fromDate).format('YYYY-MM-DD')].goal;
			$('<div class="step" value="'+ x +'">'+ eventName + '<div class="eventCount">' + count + '</div></div>').appendTo("#steps");
			x++;
		})
		$('.step').click(function(){
			var stepsSlice = steps.slice(0,$(this).attr("value"));
			var currentEvent = steps[$(this).attr("value")-1];
			var params = {
				steps:stepsSlice,
				event:currentEvent,
				to_date:moment(toDate).format('YYYY-MM-DD'),
				from_date:moment(fromDate).format('YYYY-MM-DD')
			};
			$('#tables').empty();
			if ($(this).css("background-color") == "rgb(89, 170, 233)"){
				$(".step").css("background-color", "#59aae9")
				$(this).css("background-color", "#3f516b")
				$(".selected").removeClass("selected")
				$(this).addClass("selected")
				strictOrderTables(params);
			} else {
				$(this).removeClass("selected")
				$(this).css("background-color", "#59aae9")
			}
		})
	})
}

