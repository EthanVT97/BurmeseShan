const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [16, 32, 48];
const inputSvg = path.join(__dirname, '../public/favicon.svg');
const outputIco = path.join(__dirname, '../public/favicon.ico');

async function generateFavicon() {
    try {
        // Read the SVG file
        const svgBuffer = fs.readFileSync(inputSvg);
        
        // Generate PNG buffers for each size
        const pngBuffers = await Promise.all(sizes.map(size => 
            sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toBuffer()
        ));

        // Combine all sizes into one ICO file
        const icoData = Buffer.concat([
            // ICO header (6 bytes)
            Buffer.from([0, 0, 1, 0, sizes.length, 0]),
            
            // Directory entries (16 bytes each)
            ...sizes.map((size, index) => {
                const offset = 6 + (sizes.length * 16) + pngBuffers.slice(0, index).reduce((sum, buf) => sum + buf.length, 0);
                return Buffer.from([
                    size, size,  // width, height
                    0,          // color palette
                    0,          // reserved
                    1, 0,       // color planes
                    32, 0,      // bits per pixel
                    ...Buffer.from(new Uint32Array([pngBuffers[index].length]).buffer), // size
                    ...Buffer.from(new Uint32Array([offset]).buffer)  // offset
                ]);
            }),
            
            // PNG data
            ...pngBuffers
        ]);

        // Write the ICO file
        fs.writeFileSync(outputIco, icoData);
        console.log('Favicon generated successfully!');
    } catch (error) {
        console.error('Error generating favicon:', error);
    }
}

generateFavicon();
