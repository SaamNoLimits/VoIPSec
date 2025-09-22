FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    build-essential \
    libssl-dev \
    libncurses5-dev \
    libnewt-dev \
    libxml2-dev \
    linux-headers-generic \
    libsqlite3-dev \
    uuid-dev \
    libjansson-dev \
    libxml2-dev \
    libxslt1-dev \
    curl \
    sox \
    mpg123 \
    && rm -rf /var/lib/apt/lists/*

# Create asterisk user
RUN groupadd -r asterisk && useradd -r -g asterisk asterisk

# Download and compile Asterisk
WORKDIR /usr/src
RUN wget http://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz \
    && tar xzf asterisk-20-current.tar.gz \
    && cd asterisk-20.* \
    && contrib/scripts/get_mp3_source.sh \
    && ./configure --with-pjproject-bundled --with-jansson-bundled \
    && make menuselect.makeopts \
    && menuselect/menuselect \
        --disable BUILD_NATIVE \
        --enable codec_opus \
        --enable codec_silk \
        --enable format_mp3 \
        --enable res_config_mysql \
        --enable cdr_mysql \
        --enable cel_mysql \
        --enable app_mysql \
        --enable res_config_pgsql \
        --enable cdr_pgsql \
        --enable cel_pgsql \
        menuselect.makeopts \
    && make -j$(nproc) \
    && make install \
    && make samples \
    && make config \
    && ldconfig

# Create directories
RUN mkdir -p /var/lib/asterisk/sounds/custom \
    && mkdir -p /var/spool/asterisk/monitor \
    && mkdir -p /var/spool/asterisk/voicemail \
    && mkdir -p /var/log/asterisk \
    && chown -R asterisk:asterisk /var/lib/asterisk \
    && chown -R asterisk:asterisk /var/spool/asterisk \
    && chown -R asterisk:asterisk /var/log/asterisk \
    && chown -R asterisk:asterisk /etc/asterisk

# Copy startup script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE 5060/udp 5060/tcp 5061/tcp 10000-20000/udp

# Switch to asterisk user
USER asterisk

ENTRYPOINT ["/entrypoint.sh"]
CMD ["asterisk", "-f"]
