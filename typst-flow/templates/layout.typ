// Typst Layout Template - High Fidelity Version

#let editorial-slot(tag: "", x: 0pt, y: 0pt, w: 0pt, h: 0pt, content) = {
  // En InDesign las coordenadas a veces vienen desde el borde superior de la página
  // pero el origen (0,0) en Typst es el margen. Como pusimos margen 0, dx/dy son absolutos.
  place(top + left, dx: x, dy: y)[
    #context {
      let content-size = measure(block(width: w, content))
      let has_overflow = content-size.height > h
      
      block(
        width: w,
        height: h,
        stroke: if has_overflow { 2pt + red } else { none },
        clip: true,
        {
          content
          // Aviso visual de desbordamiento
          if has_overflow {
            place(top + right, dx: 0pt, dy: -15pt)[
              #rect(fill: red, inset: 2pt, radius: 2pt)[
                #set text(fill: white, size: 8pt, weight: "bold", font: "Liberation Sans")
                EXCESO: #tag
              ]
            ]
          }
        }
      )
    }
  ]
}

#let setup-page(width, height, background_pdf: none) = {
  set page(
    width: width,
    height: height,
    margin: 0pt,
    // Aquí es donde ocurre la magia: ponemos el PDF original como fondo
    background: if background_pdf != none {
      image(background_pdf, width: width, height: height)
    }
  )
}
