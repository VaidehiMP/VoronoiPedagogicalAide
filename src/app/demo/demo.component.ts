import { Component, Directive, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Voronoi, BoundingBox, Site, Diagram } from 'voronoijs';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, ChartType, Point, registerables } from 'chart.js';
import { NgFor, NgIf } from '@angular/common';

Chart.register(...registerables); 

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [BaseChartDirective, NgFor, NgIf],
  templateUrl: './demo.component.html',
  styleUrl: './demo.component.css'
})
export class DemoComponent {
  @ViewChild('chartContainer') containerElement!: ElementRef;
  @ViewChild('chart') chartElement!: BaseChartDirective;
  @ViewChild('chart', { read: ElementRef }) canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('coord', { static: false }) coord!: ElementRef<HTMLInputElement>;

  public scatterData: ChartData = {
    datasets: [
      {
        type: 'scatter',
        label: 'trees',
        data: [],
        showLine: false,
        backgroundColor: '#000000',
        pointRadius: 6
      }
    ]
  };

  public trees = new Array<Site>;
  public numTrees = 0;
  public diagramMade = false;
  
  @HostListener('click', ['$event'])
  public putPoint(event: MouseEvent){
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON') {
      return;
    }
    const canvas = this.canvasElement?.nativeElement;
    if (!canvas || !canvas.contains(target)){
      return;
    }
    let id = this.numTrees;
    let x = event.offsetX;
    let y = event.offsetY;
    this.trees.push({id, x, y});
    this.numTrees += 1;
    this.scatterData = {
      datasets: [
        {
          ...this.scatterData.datasets[0],
          data: [...(this.scatterData.datasets[0].data || []), { x: x, y: y }]
        }
      ]
    };
    this.chartElement?.chart?.update();
  }

  public growTrees() {
    const canvas = this.canvasElement?.nativeElement;
    if (!canvas) {
      // requestAnimationFrame(() => this.growTrees());
      return;
    }
    
    const chart = canvas.getContext('2d');
    // const chart = this.chartElement?.chart?.canvas.getContext('2d');
    const width = canvas.width ?? 750;
    const height = canvas.height ?? 450;
    
    const chartInfo = chart!.getImageData(0, 0, width, height)
    const chartData = chartInfo.data;
    
    const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;
    
    const queue: Array<number> = [];
    let index = 0;
    const visited = new Uint8Array(width * height); 

    const numTrees = this.scatterData.datasets[0].data.length;
    const trees = this.scatterData.datasets[0].data;
    
    for (let i=0; i<numTrees; i++) {
      let tree = this.scatterData.datasets[0].data[i] as { x: number; y: number };
      const px = (tree.x / 750) * width;
      const py = (tree.y / 450) * height;   // flip for reverse: true

      const key = Math.round(py) * width + Math.round(px);
      queue.push(key);
      visited[key] = 1;
    }

    const step = () => {
      for (let i = 0; i < 500 && index < queue.length; i++) {
        const current: number = queue[index];
        const x = current % width;
        const y = Math.floor(current / width);
        
        const idx = (y * width + x) * 4;

        // const foliagePixels = [[6, 99, 14, 255], [120, 191, 129, 255], [35, 94, 51, 255], [14, 105, 38, 255]]
        // let pixelColor = foliagePixels[Math.floor(Math.random() * 4)]

        chartData![idx] = 6;
        chartData![idx + 1] = 99;
        chartData![idx + 2] = 14;
        chartData![idx + 3] = 255; 
        
        const neighbors = [
            { x: x + 1, y: y, direction: 'right' },
            { x: x - 1, y: y, direction: 'left' },
            { x: x, y: y + 1, direction: 'down' },
            { x: x, y: y - 1, direction: 'up' }
        ];
        
        for (const n of neighbors) {
            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                const nKey = n.y * width + n.x;
                
                if (visited[nKey] === 0) {
                  visited[nKey] = 1;
                  const nIdx = nKey * 4;
                  let fiveFrom = n.direction === 'right' ? (nIdx + 5 * 4) : n.direction === 'left' ? (nIdx - 5 * 4) : n.direction === 'down' ? (nIdx + 5 * width * 4) :n.direction === 'up' ? (nIdx - 5 * width * 4) : nIdx;

                  // console.log(chartData[fiveFrom], chartData[fiveFrom+1], chartData[fiveFrom+2], chartData[fiveFrom+3]);
                  // let onLine = !(chartData[nIdx]===0 && chartData[nIdx+1]===0 && chartData[nIdx+2]===0);
                  // let onLine = !(chartData[fiveFrom+3]===0);
                  // const onLine = chartData[nIdx+1] ===0 && chartData[nIdx] ===0 && chartData[nIdx+2] ===0 && chartData[nIdx+3]===255;
                  const onLine = chartData[nIdx] > 240 && chartData[nIdx+1] > 240 && chartData[nIdx+2] > 240 && chartData[nIdx+3] === 255;


                  if (!onLine) {
                    queue.push(nKey);
                  }
                }
            }
        }
        
        index+=1;

        // console.log(queue.length)
      }
      
      chart?.putImageData(chartInfo, 0, 0);

      if (index < queue.length) {
        requestAnimationFrame(step);        // continue
      }
    };

    requestAnimationFrame(step);
  }

  public makeVoronoiDiagram(){
    console.log('yes');
    console.log(this.scatterData.datasets);
    console.log(this.trees);
    // console.log(this.scatterData.datasets[0].data);
    // console.log(this.trees);
    let voronoi = new Voronoi();
    let bbox: BoundingBox = {xl: 0, xr: 750, yt: 0, yb: 450}; 
    // xl is x-left, xr is x-right, yt is y-top, and yb is y-bottom
    let diagram: Diagram = voronoi.compute(this.trees, bbox);
    // console.log(diagram.vertices);
    // console.log(diagram.edges);
    let numEdges = diagram.edges.length
    let newDataset = [this.scatterData.datasets[0]]
    for(let i=0; i<numEdges; i++){
      let edge = diagram.edges[i];
      newDataset.push(
        {
          type: 'scatter',
          label: 'Line' + i,
          data: [{x: edge.va.x, y: edge.va.y}, {x: edge.vb.x, y: edge.vb.y}],
          borderColor: 'white',
          showLine: true,
          pointRadius: 0,
          borderWidth: 6, 
          order: 0
        }
      );
    }
    // this.scatterData.datasets = newDataset;
    this.scatterData = {
      datasets: newDataset
    };

    this.chartElement?.chart?.update();
    requestAnimationFrame(() => this.growTrees());
    this.diagramMade = true;
    console.log(this.diagramMade);

//     this.growTrees(() => {
//   console.log('done');
//   this.restoreChart();
// });

    // console.log('done');

    // this.restoreChart();


    // setTimeout(() => this.growTrees(), 50);
  }

  public removeTree(){
     const canvas = this.canvasElement?.nativeElement;
    if (!canvas) {
      // requestAnimationFrame(() => this.growTrees());
      return;
    }
    
    const chart = canvas.getContext('2d');
    // const chart = this.chartElement?.chart?.canvas.getContext('2d');
    const width = canvas.width ?? 750;
    const height = canvas.height ?? 450;
    
    const chartInfo = chart!.getImageData(0, 0, width, height)
    const chartData = chartInfo.data;
        
    const queue: Array<number> = [];
    let index = 0;
    const visited = new Uint8Array(width * height); 

    // console.log(this.coord.nativeElement.value);
    const tree = this.coord.nativeElement.value.split(',');
    const px = (parseInt(tree[0]) / 750) * width;
    const py = (parseInt(tree[1]) / 450) * height;   // flip for reverse: true

    const key = Math.round(py) * width + Math.round(px);
    queue.push(key);
    visited[key] = 1;

    const step = () => {
      for (let i = 0; i < 500 && index < queue.length; i++) {
        const current: number = queue[index];
        const x = current % width;
        const y = Math.floor(current / width);
        
        const idx = (y * width + x) * 4;

        // const foliagePixels = [[6, 99, 14, 255], [120, 191, 129, 255], [35, 94, 51, 255], [14, 105, 38, 255]]
        // let pixelColor = foliagePixels[Math.floor(Math.random() * 4)]

        chartData![idx]     = 105;
        chartData![idx + 1] = 89;
        chartData![idx + 2] = 58;
        chartData![idx + 3] = 255;
        
        const neighbors = [
            { x: x + 1, y: y, direction: 'right' },
            { x: x - 1, y: y, direction: 'left' },
            { x: x, y: y + 1, direction: 'down' },
            { x: x, y: y - 1, direction: 'up' }
        ];
        
        for (const n of neighbors) {
            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                const nKey = n.y * width + n.x;
                
                if (visited[nKey] === 0) {
                  visited[nKey] = 1;
                  const nIdx = nKey * 4;
                  let fiveFrom = n.direction === 'right' ? (nIdx + 5 * 4) : n.direction === 'left' ? (nIdx - 5 * 4) : n.direction === 'down' ? (nIdx + 5 * width * 4) :n.direction === 'up' ? (nIdx - 5 * width * 4) : nIdx;

                  // console.log(chartData[fiveFrom], chartData[fiveFrom+1], chartData[fiveFrom+2], chartData[fiveFrom+3]);
                  // let onLine = !(chartData[nIdx]===0 && chartData[nIdx+1]===0 && chartData[nIdx+2]===0);
                  // let onLine = !(chartData[fiveFrom+3]===0);
                  // const onLine = chartData[nIdx+1] ===0 && chartData[nIdx] ===0 && chartData[nIdx+2] ===0 && chartData[nIdx+3]===255;
                  const onLine = chartData[nIdx] > 240 && chartData[nIdx+1] > 240 && chartData[nIdx+2] > 240 && chartData[nIdx+3] === 255;


                  if (!onLine) {
                    queue.push(nKey);
                  }
                }
            }
        }
        
        index+=1;

        // console.log(queue.length)
      }
      
      chart?.putImageData(chartInfo, 0, 0);

      if (index < queue.length) {
        requestAnimationFrame(step);        // continue
      }
      else{
        let trees = this.scatterData.datasets[0].data;
        const numTrees = trees.length;
        const treeFallen = this.coord.nativeElement.value.split(',');
        let index = 0;
        for(let i=0; i<numTrees; i++){
          const t = trees[i] as {x:number, y:number};
          if(t.x===parseInt(treeFallen[0]) && t.y===parseInt(treeFallen[1])){
            index = i;
            break;
          }
        }
        trees.splice(index, 1);
        this.scatterData = {
          datasets: [
            {
              ...this.scatterData.datasets[0],
              data: trees
            }
          ]
        };
        this.trees.splice(index, 1);
        this.chartElement?.chart?.update();
        this.makeVoronoiDiagram();
      }
    };

    requestAnimationFrame(step);
  }

  // public removeTree() {
  //   requestAnimationFrame(() => this.treeFall());
  //   let trees = this.scatterData.datasets[0].data;
  //   const numTrees = trees.length;
  //   const treeFallen = this.coord.nativeElement.value.split(',');
  //   let index = 0;
  //   for(let i=0; i<numTrees; i++){
  //     const t = trees[i] as {x:number, y:number};
  //     if(t.x===parseInt(treeFallen[0]) && t.y===parseInt(treeFallen[1])){
  //       index = i;
  //       break;
  //     }
  //   }
  //   trees = trees.splice(index, 1);
  //   this.scatterData = {
  //     datasets: [
  //       {
  //         ...this.scatterData.datasets[0],
  //         data: trees
  //       },
  //       ...this.scatterData.datasets.slice(1)
  //     ]
  //   };
  //   this.makeVoronoiDiagram();
  // }

  public chartOptions: any = {
    responsive: false,
    maintainAspectRatio: false,
    animation: false, 
    layout: {
      padding: 0
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    elements: {
      line: {
        showLine: true,
        tension: 0
      }
    },
    scales: {
      x: {
        type: 'linear',
        display: false,
        min: 0,
        max: 750,
        reverse: false,
        offset: false,
        border: { display: false },
      },
      y: {
        type: 'linear',
        display: false,
        min: 0,
        max: 450,
        reverse: true,
        offset: false,
        border: { display: false },
      }
    }
  };
}
