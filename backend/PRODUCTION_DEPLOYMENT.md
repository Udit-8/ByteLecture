# ByteLecture Backend - Production Deployment Guide

This guide covers deploying the ByteLecture backend with yt-dlp and ffmpeg audio processing capabilities to production.

## 📋 Prerequisites

Your ByteLecture backend requires these system dependencies for audio processing:
- **Node.js 18+**
- **ffmpeg** (for audio processing and chunking)
- **yt-dlp** (for YouTube video download and metadata extraction)
- **Python 3** (required by yt-dlp)

## 🚀 Deployment Options

### Option 1: Railway (Recommended for Simplicity)

**Pros:**
- ✅ Zero-config deployment with automatic dependency detection
- ✅ Built-in system dependencies (ffmpeg, Python, yt-dlp)
- ✅ Automatic HTTPS and custom domains
- ✅ Git-based deployments with automatic rebuilds
- ✅ Excellent for audio processing workloads
- ✅ Cost-effective scaling

**Steps:**

1. **Deploy with one command:**
```bash
cd backend
cp .env.production.example .env
# Edit .env with your production values
chmod +x scripts/deploy-railway.sh
./scripts/deploy-railway.sh
```

2. **Monitor the deployment:**
```bash
railway logs
railway status
railway domain  # Get your app URL
```

3. **Validate deployment:**
```bash
./scripts/validate-production.sh https://your-project.railway.app
```

**Railway-specific Configuration:**
- Uses `nixpacks.toml` for system dependencies
- Automatic port binding via `$RAILWAY_PORT`
- Environment variables managed via Railway dashboard
- Persistent storage for temp audio files

---

### Option 2: Docker Deployment

**Pros:** 
- ✅ Consistent environment across all platforms
- ✅ All dependencies bundled
- ✅ Easy scaling and management
- ✅ Isolated from host system

**Steps:**

1. **Build the Docker image:**
```bash
cd backend
docker build -t bytelecture-backend .
```

2. **Run with Docker Compose:**
```bash
# Copy environment variables
cp .env.example .env
# Edit .env with your production values

# Start the service
docker-compose up -d
```

3. **Monitor the deployment:**
```bash
docker-compose logs -f
docker-compose ps
```

**Environment Variables for Docker:**
```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
YOUTUBE_API_KEY=your_youtube_key
YT_CHUNK_MINUTES=10
SUMMARY_MAX_TOKENS=2500
```

---

### Option 3: Traditional Linux Server

**Pros:**
- ✅ Direct control over the environment
- ✅ Can optimize for specific hardware
- ✅ Lower resource overhead than containers

**Steps:**

1. **Run the production setup script:**
```bash
cd backend
chmod +x scripts/setup-production.sh
sudo ./scripts/setup-production.sh
```

2. **Configure environment variables:**
```bash
cp .env.example .env
nano .env  # Edit with your production values
```

3. **Start the application:**
```bash
sudo systemctl enable bytelecture
sudo systemctl start bytelecture
```

4. **Monitor the application:**
```bash
pm2 status
pm2 logs
sudo systemctl status bytelecture
```

---

### Option 4: Cloud Provider Specific

#### AWS EC2 + ECS Fargate

```yaml
# fargate-task-definition.json
{
  "family": "bytelecture-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilityies": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "bytelecture-backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/bytelecture-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {
          "name": "SUPABASE_URL",
          "valueFrom": "arn:aws:ssm:region:account:parameter/bytelecture/supabase-url"
        },
        {
          "name": "OPENAI_API_KEY", 
          "valueFrom": "arn:aws:ssm:region:account:parameter/bytelecture/openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bytelecture-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Google Cloud Run

```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: bytelecture-backend
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "1"
        run.googleapis.com/timeout: "300s"
    spec:
      containers:
      - image: gcr.io/YOUR_PROJECT/bytelecture-backend
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: supabase-config
              key: url
        resources:
          limits:
            memory: 2Gi
            cpu: 1000m
          requests:
            memory: 512Mi
            cpu: 250m
```

Deploy with:
```bash
gcloud run deploy bytelecture-backend \
  --image gcr.io/YOUR_PROJECT/bytelecture-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300s \
  --concurrency 10
```

#### Azure Container Instances

```yaml
# azure-container.yaml
apiVersion: 2018-10-01
location: eastus
name: bytelecture-backend
properties:
  containers:
  - name: bytelecture-backend
    properties:
      image: your-registry.azurecr.io/bytelecture-backend:latest
      resources:
        requests:
          cpu: 1
          memoryInGb: 2
      ports:
      - port: 3000
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: PORT
        value: '3000'
      - name: SUPABASE_URL
        secureValue: your-supabase-url
      - name: OPENAI_API_KEY
        secureValue: your-openai-key
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: tcp
      port: 3000
```

Deploy with:
```bash
az container create --resource-group myResourceGroup --file azure-container.yaml
```

---

## 🔧 Production Configuration

### Environment Variables

Create a `.env` file with these production values:

```env
# Application
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# AI Services
OPENAI_API_KEY=sk-your-openai-key
YOUTUBE_API_KEY=your-youtube-api-key

# Audio Processing Configuration
YT_CHUNK_MINUTES=10           # Minutes per audio chunk (default: 10)
SUMMARY_MAX_TOKENS=2500       # Max tokens for AI summaries (default: 2500)

# Optional: Performance Tuning
MAX_CONCURRENT_JOBS=3         # Concurrent transcription jobs
AUDIO_QUALITY=medium          # low, medium, high
CACHE_TTL_HOURS=24           # Cache duration in hours
```

### Resource Requirements

**Minimum Requirements:**
- **CPU:** 1 vCPU
- **RAM:** 1GB
- **Storage:** 10GB (for temporary audio files)
- **Network:** High bandwidth for video downloads

**Recommended for Production:**
- **CPU:** 2+ vCPUs (for concurrent processing)
- **RAM:** 2-4GB (audio files can be large)
- **Storage:** 20-50GB SSD (faster I/O for audio processing)
- **Network:** 100+ Mbps (for large video downloads)

### Performance Optimization

1. **Enable chunked processing for long videos:**
```env
YT_CHUNK_MINUTES=10  # Process in 10-minute chunks
MAX_CONCURRENT_JOBS=3  # Process 3 chunks simultaneously
```

2. **Optimize ffmpeg settings:**
```env
AUDIO_QUALITY=medium  # Balance quality vs speed
AUDIO_BITRATE=48k     # Lower bitrate for faster processing
```

3. **Configure caching:**
```env
CACHE_TTL_HOURS=24    # Cache results for 24 hours
REDIS_URL=redis://your-redis-instance  # Optional Redis cache
```

---

## 📊 Monitoring & Logging

### Health Checks

Your application includes health check endpoints:

```bash
# Basic health check
curl http://your-domain.com/api/health

# Audio processing health
curl http://your-domain.com/api/youtube/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "ytDlpAvailable": true,
    "ytDlpVersion": "2023.12.30",
    "ffmpegAvailable": true
  }
}
```

### Log Monitoring

**Docker Logs:**
```bash
docker-compose logs -f
docker logs bytelecture-backend
```

**PM2 Logs:**
```bash
pm2 logs bytelecture-backend
pm2 monit  # Real-time monitoring
```

**Important Log Patterns to Monitor:**
- `❌ yt-dlp failed` - Video download issues
- `📊 Audio duration:` - Processing time tracking
- `✅ CHUNKED transcript generated` - Successful chunked processing
- `Memory usage:` - Resource consumption

### Alerts to Set Up

1. **High Memory Usage** (>1.5GB)
2. **Audio Processing Failures** (error rate >5%)
3. **Long Processing Times** (>5 minutes for 20-minute videos)
4. **Disk Space** (temp directory >80% full)
5. **API Rate Limits** (YouTube/OpenAI quota exceeded)

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. "yt-dlp not found"
```bash
# Check installation
which yt-dlp
yt-dlp --version

# Reinstall if needed
pip3 install --upgrade yt-dlp
```

#### 2. "ffmpeg not found"
```bash
# Check installation
which ffmpeg
ffmpeg -version

# Install on Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Install on CentOS/RHEL
sudo yum install epel-release
sudo yum install ffmpeg
```

#### 3. "Audio extraction failed"
- Check video URL accessibility
- Verify internet connectivity
- Check available disk space
- Try with a different video

#### 4. "Out of memory"
- Reduce chunk size: `YT_CHUNK_MINUTES=5`
- Increase container memory limit
- Monitor temp directory cleanup

#### 5. "Processing timeout"
- Increase timeout limits in your load balancer
- Use chunked processing for long videos
- Optimize audio quality settings

### Debug Mode

Enable detailed logging:

```bash
export DEBUG=youtube:*,audio:*
export NODE_ENV=development
npm start
```

---

## 🔒 Security Considerations

### API Key Management

1. **Never commit API keys to code**
2. **Use environment variables or secret management**
3. **Rotate keys regularly**
4. **Monitor API usage and costs**

### Network Security

1. **Use HTTPS in production**
2. **Configure proper CORS settings**
3. **Implement rate limiting**
4. **Use reverse proxy (nginx/cloudflare)**

### File Security

1. **Limit file upload sizes**
2. **Sanitize file names**
3. **Clean up temp files regularly**
4. **Monitor disk usage**

---

## 📈 Scaling Considerations

### Horizontal Scaling

For high-volume processing:

1. **Load Balancer:** Distribute requests across multiple instances
2. **Queue System:** Use Redis/RabbitMQ for job queuing
3. **Dedicated Workers:** Separate API servers from processing workers
4. **CDN:** Cache processed content

### Vertical Scaling

For better performance per instance:

1. **More CPU cores:** Increase concurrent processing
2. **More RAM:** Handle larger audio files
3. **SSD storage:** Faster audio file I/O
4. **Network bandwidth:** Faster downloads

---

## 💰 Cost Optimization

### Estimated Monthly Costs

**For 1000 videos/month (avg 20 minutes each):**

- **Compute (2 vCPU, 4GB RAM):** $50-100/month
- **Storage (temp files):** $5-15/month  
- **Bandwidth:** $10-30/month
- **OpenAI Whisper API:** $6-18/month (0.006/minute)
- **Total:** ~$71-163/month

### Cost Reduction Tips

1. **Cache aggressively** - avoid reprocessing
2. **Optimize chunk sizes** - balance speed vs cost  
3. **Clean up temp files** - reduce storage costs
4. **Monitor API usage** - avoid surprise bills
5. **Use spot/preemptible instances** - 60-70% cost savings

---

## 🚀 Quick Start Commands

### Railway (Recommended)
```bash
git clone your-repo
cd backend
cp .env.production.example .env
# Edit .env with your values
./scripts/deploy-railway.sh
```

### Docker
```bash
git clone your-repo
cd backend
cp .env.production.example .env
# Edit .env with your values
docker-compose up -d
```

### Linux Server
```bash
git clone your-repo
cd backend
chmod +x scripts/setup-production.sh
sudo ./scripts/setup-production.sh
cp .env.example .env
# Edit .env with your values
sudo systemctl start bytelecture
```

### Development Testing
```bash
# Test audio processing
curl -X POST http://localhost:3000/api/youtube/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"url": "https://www.youtube.com/watch?v=test"}'
```

---

## 📞 Support

If you encounter issues:

1. Check the logs first
2. Verify all dependencies are installed
3. Test with the health check endpoints
4. Review this deployment guide
5. Check GitHub issues for similar problems

The ByteLecture backend is designed to be robust and handle production workloads with proper configuration and monitoring. 