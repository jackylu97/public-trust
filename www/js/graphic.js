var GRAPHIC = (function() {
    var COLORS = {
        'red1': '#A30000', 'red2': '#A30000', 'red3': '#A30000', 'red4': '#E27560', 'red5': '#ECA395', 'red6': '#F5D1CA',
        'orange1': '#714616', 'orange2': '#AA6A21', 'orange3': '#E38D2C', 'orange4': '#EAAA61', 'orange5': '#F1C696', 'orange6': '#F8E2CA',
        'yellow1': '#77631B', 'yellow2': '#B39429', 'yellow3': '#EFC637', 'yellow4': '#F3D469', 'yellow5': '#F7E39B', 'yellow6': '#FBF1CD',
        'teal1': '#0B403F', 'teal2': '#11605E', 'teal3': '#17807E', 'teal4': '#51A09E', 'teal5': '#8BC0BF', 'teal6': '#C5DFDF',
        'blue1': '#28556F', 'blue2': '#3D7FA6', 'blue3': '#51AADE', 'blue4': '#7DBFE6', 'blue5': '#A8D5EF', 'blue6': '#D3EAF7'
    };

    /*
     * Convert arbitrary strings to valid css classes.
     * via: https://gist.github.com/mathewbyrne/1280286
     *
     * NOTE: This implementation must be consistent with the Python classify
     * function defined in base_filters.py.
     */
    var classify = function(str) {
        return str.toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }

    /*
     * Convert key/value pairs to a style string.
     */
    var formatStyle = function(props) {
        var s = '';

        for (var key in props) {
            s += key + ': ' + props[key].toString() + '; ';
        }

        return s;
    }

    /*
     * Create a SVG tansform for a given translation.
     */
    var makeTranslate = function(x, y) {
        var transform = d3.transform();

        transform.translate[0] = x;
        transform.translate[1] = y;

        return transform.toString();
    }

    /*
     * Parse a url parameter by name.
     * via: http://stackoverflow.com/a/901144
     */
    var getParameterByName = function(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    /*
     * Convert a url to a location object.
     */
    var urlToLocation = function(url) {
        var a = document.createElement('a');
        a.href = url;
        return a;
    }

    // Global config
    var GRAPHIC_DEFAULT_WIDTH = 600;
    var MOBILE_THRESHOLD = 500;

    // Global vars
    var isMobile = false;

    // D3 formatters
    var fmtYearAbbrev = d3.time.format('%y');
    var fmtYearFull = d3.time.format('%Y');

    /*
     * Format graphic data for processing by D3.
     */
    var formatData = function(graphicData) {
        graphicData.forEach(function(d) {
            d['date'] = d3.time.format('%m/%d/%y').parse(d['date']);

            for (var key in d) {
                if (key != 'date') {
                    d[key] = +d[key];
                }
            }
        });

        return graphicData;
    }

    /*
     * Render the graphic(s). Called by pym with the container width.
     */
    var render = function(container, graphicData) {

        $container = $(container);
        containerWidth = $container.width();

        if (!containerWidth) {
            containerWidth = GRAPHIC_DEFAULT_WIDTH;
        }

        if (containerWidth <= MOBILE_THRESHOLD) {
            isMobile = true;
        } else {
            isMobile = false;
        }

        // Render the chart!
        renderLineChart({
            container: container,
            width: containerWidth,
            data: graphicData,
        });
    }

    /*
     * Render a line chart.
     */
    var renderLineChart = function(config) {

        /*
         * Setup
         */
        var dateColumn = 'date';
        var valueColumn = 'amt';

        var aspectWidth = isMobile ? 4 : 30;
        var aspectHeight = isMobile ? 3 : 10;

        var margins = {
            top: 5,
            right: 75,
            bottom: 20,
            left: 50,
        };

        var ticksX = 10;
        var ticksY = 10;
        var roundTicksFactor = 5;

        // Mobile
        if (isMobile) {
            ticksX = 5;
            ticksY = 5;
            margins['right'] = 25;
        }

        // Calculate actual chart dimensions
        var chartWidth = config['width'] - margins['left'] - margins['right'];
        var chartHeight = Math.ceil((config['width'] * aspectHeight) / aspectWidth) - margins['top'] - margins['bottom'];

        // Clear existing graphic (for redraw)
        var containerElement = d3.select(config['container']);
        containerElement.html('');

        var graphicData = config['data'];

        var formattedData = {};

        /*
         * Restructure tabular data for easier charting.
         */
        for (var column in graphicData[0]) {
            if (column == dateColumn) {
                continue;
            }

            formattedData[column] = graphicData.map(function(d) {
                return {
                    'date': d[dateColumn],
                    'amt': d[column]
                };
    // filter out empty data. uncomment this if you have inconsistent data.
    //        }).filter(function(d) {
    //            return d['amt'].length > 0;
            });
        }

        /*
         * Create D3 scale objects.
         */
        var xScale = d3.time.scale()
            .domain(d3.extent(config['data'], function(d) {
                return d[dateColumn];
            }))
            .range([ 0, chartWidth ])

        var yScale = d3.scale.linear()
            .domain([ 0, d3.max(d3.entries(formattedData), function(c) {
                    return d3.max(c['value'], function(v) {
                        var n = v[valueColumn];
                        return Math.ceil(n / roundTicksFactor) * roundTicksFactor;
                    });
                })
            ])
            .range([ chartHeight, 0 ]);

        var colorScale = d3.scale.ordinal()
            .domain(d3.keys(config['data'][0]).filter(function(key) {
                return key !== dateColumn;
            }))
            .range([ COLORS['red3'], COLORS['yellow3'], COLORS['blue3'], COLORS['orange3'], COLORS['teal3'] ]);

        /*
         * Create the root SVG element.
         */
        var chartWrapper = containerElement.append('div')
            .attr('class', 'graphic-wrapper');

        var chartElement = chartWrapper.append('svg')
            .attr('width', chartWidth + margins['left'] + margins['right'])
            .attr('height', chartHeight + margins['top'] + margins['bottom'])
            .append('g')
            .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

        /*
         * Create D3 axes.
         */
        var xAxis = d3.svg.axis()
            .scale(xScale)
            .orient('bottom')
            .ticks(ticksX)
            .tickFormat(function(d, i) {
                if (isMobile) {
                    return '\u2019' + fmtYearAbbrev(d);
                } else {
                    return fmtYearFull(d);
                }
            });

        var yAxis = d3.svg.axis()
            .scale(yScale)
            .orient('left')
            .ticks(ticksY)

        /*
         * Render axes to chart.
         */
        chartElement.append('g')
            .attr('class', 'x axis')
            .attr('transform', makeTranslate(0, chartHeight))
            .call(xAxis);

        chartElement.append('g')
            .attr('class', 'y axis')
            .call(yAxis);

        /*
         * Render grid to chart.
         */
        var xAxisGrid = function() {
            return xAxis;
        }

        var yAxisGrid = function() {
            return yAxis;
        }

        chartElement.append('g')
            .attr('class', 'x grid')
            .attr('transform', makeTranslate(0, chartHeight))
            .call(xAxisGrid()
                .tickSize(-chartHeight, 0, 0)
                .tickFormat('')
            );

        chartElement.append('g')
            .attr('class', 'y grid')
            .call(yAxisGrid()
                .tickSize(-chartWidth, 0, 0)
                .tickFormat('')
            );

        /*
         * Render lines to chart.
         */
        var line = d3.svg.line()
            .interpolate('monotone')
            .x(function(d) {
                return xScale(d[dateColumn]);
            })
            .y(function(d) {
                return yScale(d[valueColumn]);
            });

        chartElement.append('g')
            .attr('class', 'lines')
            .selectAll('path')
            .data(d3.entries(formattedData))
            .enter()
            .append('path')
                .attr('class', function(d, i) {
                    return 'line line-' + i + ' ' + classify(d['key']);
                })
                .attr('stroke', function(d) {
                    return colorScale(d['key']);
                })
                .attr('d', function(d) {
                    return line(d['value']);
                });
    }

    var lineChart = function(url, container) {
        var graphicData;

        var renderChart = function() {
            render(container, graphicData);
        }

        d3.csv(url, function(error, data) {
            graphicData = formatData(data);
            renderChart();
        });

        window.addEventListener("resize", renderChart);
    }

    return {
        'lineChart': lineChart,
    }

}());
