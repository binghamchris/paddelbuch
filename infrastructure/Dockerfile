# Custom Amplify Build Image
# Pre-packages Ruby 3.4.9, Node.js 22, and project dependencies
# Build from project root: docker build -t paddelbuch-build -f infrastructure/Dockerfile .

FROM amazonlinux:2023

# Layer 1 — System dependencies for compiling Ruby and native extensions
RUN dnf install -y \
    gcc \
    gcc-c++ \
    make \
    autoconf \
    bison \
    openssl-devel \
    readline-devel \
    zlib-devel \
    libyaml-devel \
    libffi-devel \
    gdbm-devel \
    tar \
    gzip \
    git \
    which \
    procps-ng \
  && dnf clean all \
  && rm -rf /var/cache/dnf

# Layer 2 — Ruby 3.4.9 compiled from source
RUN curl -fsSL https://cache.ruby-lang.org/pub/ruby/3.4/ruby-3.4.9.tar.gz -o /tmp/ruby.tar.gz \
  && cd /tmp \
  && tar xzf ruby.tar.gz \
  && cd ruby-3.4.9 \
  && ./configure --disable-install-doc \
  && make -j$(nproc) \
  && make install \
  && cd / \
  && rm -rf /tmp/ruby*

# Layer 3 — Node.js 22 from official binary archive
RUN curl -fsSL https://nodejs.org/dist/v22.16.0/node-v22.16.0-linux-x64.tar.gz -o /tmp/node.tar.gz \
  && tar xzf /tmp/node.tar.gz -C /usr/local --strip-components=1 \
  && rm /tmp/node.tar.gz

# Layer 4 — Gem dependencies
COPY Gemfile Gemfile.lock ./
RUN bundle install

# Layer 5 — npm dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Ensure Ruby and Node.js are on PATH (both install to /usr/local/bin)
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /app
