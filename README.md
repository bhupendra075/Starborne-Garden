**Starborne Garden 🌌**

Starborne Garden is a high-performance, interactive generative art experience built using Vanilla JavaScript and HTML5 Canvas. It features a reactive "plexus" system where particles form organic, constellation-like connections based on proximity and user interaction.

**✨ Features**

Fluid Interactive Constellations: Particles dynamically link to neighbors within a specific radius, creating a living network.

**Mobile-First Design:**

High-DPI Support: Automatically detects and scales for Retina and 4K displays using window.devicePixelRatio.

Touch Optimized: Uses modern Pointer Events to handle both mouse and touch input simultaneously.

**Physics-Based Interactions:**

Directional Ripples: Dragging or swiping "pushes" the particles in the direction of motion.

Haptic "Shatter": Long-pressing severs connections temporarily, causing a structural collapse of the garden.

Gyroscope Integration: On supported mobile devices, physical movement creates ripples based on the device's acceleration.

Optimized Performance: Uses squared-distance logic to minimize computational load during the rendering loop.

🚀 How to Use

Direct Launch: Open index.html in any modern web browser.

Interact:

Move/Drag: Move your mouse or finger to influence particle flow.

Tap/Click: Create a sudden ripple effect.

Hold: Disrupt the connections between stars.

Mobile Permissions: On iOS, click the "Start Experience" button to enable the motion sensors (gyroscope).

🛠️ Technical Details

Mathematical Foundation

Each particle follows a path based on a variation of the Rose Curve formula. The radial distance $r$ is calculated as:

$$r = \text{baseRadius} + a \cdot \cos(n \cdot \theta + \omega \cdot t)$$

Where:

$a$ is the amplitude of the oscillation.

$n$ determines the frequency of the petal-like movement.

$\omega$ is the angular velocity over time $t$.

Optimization Logic

To maintain a high frame rate, the engine avoids costly square root operations when calculating distances between particles. Instead, it compares the squared distance:

$$d^2 = \Delta x^2 + \Delta y^2$$

Connections are only drawn if $d^2 < \text{connectRadius}^2$.

🎨 Configuration

You can customize the experience by adjusting the config constant in the script:

const config = {
    particleCount: 400, // Number of stars
    connectRadius: 80,  // Distance for lines to form
    decayRate: 0.98,    // Friction/decay for ripples
};


📄 License

This project is open-source and free to use for personal or educational purposes.
