FROM nvidia/opencl:devel-ubuntu18.04

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    ocl-icd-opencl-dev \
    git \
    pkg-config \
    libssl-dev

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Node.js 16.x (compatible with Ubuntu 18.04)
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs

WORKDIR /home

# Copy all source files
COPY . .

# Build the Rust binary
RUN cargo build --release

# Install Node.js dependencies
RUN npm install

# Set environment variables with defaults
ENV DEVICE_ID=0
ENV MINER_PATH=/home/target/release/fourfourfourfour
ENV REDIS_HOST=localhost
ENV REDIS_PORT=6379

# Default command runs the Node.js worker
CMD ["npm", "start"]
